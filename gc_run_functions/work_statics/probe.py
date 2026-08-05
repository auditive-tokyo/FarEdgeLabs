"""Dump raw Jibble responses. A development tool, not part of the deployed path.

    python3 probe.py                       # 30-day window, everything
    python3 probe.py --days 7 --save /tmp  # narrower, and keep the JSON

Reads credentials from `.env` beside this file — `JIBBLE_API_KEY` and
`JIBBLE_API_SECRET`, Jibble's own names for the pair. Anything already exported in
the shell wins over the file (`load_dotenv` does not override by default), so a one-off
run against other credentials needs no editing. That `.env` is covered by the
repository's `.gitignore` (`.env`, unanchored, so it matches at any depth); **check
that before adding another one elsewhere.**

`python-dotenv` lives in `requirements-dev.txt`, not `requirements.txt`. The deployed
function reads no `.env` — its secrets come from Secret Manager and there is no file in
the container — so shipping a dotenv reader would put a dependency in production that
can never run there. It replaced a hand-rolled parser: a local venv is needed anyway to
run `functions-framework`, which was the only argument for hand-rolling, and fifteen
lines of quoting rules are fifteen lines to be wrong about.

> [!note] Quote values in `.env`
> dotenv treats `#` after an unquoted value as a comment. A secret containing one would
> be silently truncated, producing a credential that looks present and fails to
> authenticate. Quoting sidesteps it.

Everything that turns a response into a number lives in `main.py` and is imported.
The point of a probe is to disagree with production when production is wrong, and it
cannot do that with a private copy of the arithmetic.

> [!warning] The output contains real names and real money
> Client names, project names, the member's own name, and `billableAmount` on every
> row. Fine to read locally. Do not paste it into an issue, a commit, or a chat.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.parse

from main import (
    DEFAULT_ENV_FILE,
    TIME_ATTENDANCE,
    TIME_TRACKING,
    WINDOW_DAYS,
    WORKSPACE,
    api_get,
    duration_to_hours,
    get_token,
    load_env,
    summarise_grouping,
    window,
)


# --------------------------------------------------------------------------- #
# Reporting
# --------------------------------------------------------------------------- #


#: How deep to walk a response. Enough for OData's
#: `value[].items[].subject.entityType` and no more: the point is to see the shape, and
#: an unexpectedly deep document should print less than nobody reads, not more.
MAX_DESCRIBE_DEPTH = 6


def describe(
    obj, path: str = "", out: dict[str, str] | None = None, depth: int = 0
) -> dict[str, str]:
    """Collect `key path -> type`, ignoring values.

    Which identifiers come back is a question about *keys*; dumping the values answers
    it too but buries it. Lists collapse to their first element — every entry in an
    OData collection shares a shape, so the second adds nothing.

    Three functions rather than one because the single version was over Sonar's
    cognitive-complexity limit (python:S3776), and the seams were already there: this
    owns the accumulator and the depth guard, `_describe_children` owns what a
    container's parts are called, and `_record` owns whether a part is a leaf or
    another container. That last decision used to be written twice — once in the dict
    arm and once in the list arm.
    """
    if out is None:
        out = {}
    if depth <= MAX_DESCRIBE_DEPTH:
        _describe_children(obj, path, out, depth)
    return out


def _describe_children(obj, path: str, out: dict[str, str], depth: int) -> None:
    """Hand each part of a container to `_record`, named by the path that reaches it."""
    if isinstance(obj, dict):
        for key, value in obj.items():
            _record(value, f"{path}.{key}" if path else key, out, depth)
    elif isinstance(obj, list):
        if obj:
            _record(obj[0], f"{path}[]", out, depth)
        else:
            # Recorded rather than skipped: "this key exists and was empty this time"
            # is exactly the kind of thing worth knowing about a response.
            out.setdefault(f"{path}[]", "empty list")


def _record(value, path: str, out: dict[str, str], depth: int) -> None:
    """A leaf records its type; a container gets walked.

    Sending a list's first element through here rather than back into `describe` also
    fixes something. `describe` returns untouched for anything that is not a dict or a
    list, so a list of scalars — `labels: ["urgent", "internal"]` — used to record
    **nothing at all**. Only lists of objects and empty lists ever showed up.
    """
    if isinstance(value, (dict, list)):
        describe(value, path, out, depth + 1)
    else:
        out.setdefault(path, type(value).__name__)


def report(label: str, url: str, status: int, payload) -> None:
    print("=" * 78)
    print(label)
    print(url)
    print(f"HTTP {status}")

    if isinstance(payload, dict):
        # OData reports the total and whether another page exists. Both matter: a count
        # above the page size means an aggregate is wrong unless nextLink is followed.
        for meta in ("@odata.count", "@odata.nextLink"):
            if meta in payload:
                print(f"{meta}: {payload[meta]}")
        value = payload.get("value")
        if isinstance(value, list):
            print(f"value: {len(value)} item(s) on this page")

    print("-" * 78)
    print("keys:")
    for key, kind in sorted(describe(payload).items()):
        print(f"  {key}: {kind}")

    print("-" * 78)
    print(json.dumps(payload, indent=2, ensure_ascii=False))
    print()


# --------------------------------------------------------------------------- #
# Probes
# --------------------------------------------------------------------------- #


def odata(**options: str) -> str:
    """Build an OData query string from Python-friendly names: `select=` -> `$select=`.

    OData prefixes every system query option with `$`, which at a call site is a
    character repeated on every key with nothing to say. Putting the prefix here leaves
    the call reading as the question being asked — `odata(select=..., top="5")` — and
    means the wire format is written down once.

    `urlencode` and not `quote`: encoding a whole query string with `&` in the safe set
    is what percent-encoded the separators the first time round, so the server saw one
    enormous `$count` value and said exactly that. Each parameter is encoded on its own.

    Not for `$expand` expressions. `client($select=id,name)` needs its parentheses and
    commas left alone, so the two calls that use one build their query by hand.
    """
    return urllib.parse.urlencode({f"${name}": value for name, value in options.items()})


#: One definition rather than two. `fetch_person_ids` and the People probe were asking
#: the same question in two places, which is the duplication worth removing here — the
#: `$select` key was only the visible half of it.
PEOPLE_QUERY = odata(select="id,fullName,role")


def fetch_person_ids(token: str) -> list[str]:
    status, payload = api_get(f"{WORKSPACE}/People?{PEOPLE_QUERY}", token)
    if status != 200 or not isinstance(payload, dict):
        print(f"could not list people (HTTP {status})", file=sys.stderr)
        return []
    return [row["id"] for row in payload.get("value", []) if row.get("id")]


def build_probes(frm: str, to: str, person_ids: list[str]) -> list[tuple[str, str]]:
    """What to ask, and why each one earns a round trip.

    `TrackedTimeReport` is the endpoint the published figures come from. `groupBy` is
    tried with several values because the help pages list date / member / activity /
    project / client but the API is the authority; a rejected value comes back as a 4xx
    carrying Jibble's own message, which answers the question either way.
    """
    window_qs = f"from={frm}&to={to}"
    expand = "$expand=" + urllib.parse.quote("Subject,Items($expand=Subject)", safe="$(),")

    probes: list[tuple[str, str]] = [
        # Token check, org id, and the timezone. "The last 30 days" is a different
        # window in Asia/Tokyo than in UTC, and the figures should match the dashboard
        # the operator sees.
        ("Organization — token check, timezone, org id", f"{WORKSPACE}/Organizations"),
        ("Clients", f"{WORKSPACE}/Clients"),
        (
            "Projects (with client and location expanded)",
            f"{WORKSPACE}/Projects?"
            + urllib.parse.quote("$expand=client($select=id,name),location($select=id,name)", safe="=$(),"),
        ),
        ("People", f"{WORKSPACE}/People?{PEOPLE_QUERY}"),
    ]

    for group_by in ("Member", "Client", "Project", "Activity", "Date"):
        probes.append(
            (
                f"TrackedTimeReport groupBy={group_by}",
                f"{TIME_ATTENDANCE}/TrackedTimeReport?{window_qs}"
                f"&groupBy={group_by}&subGroupBy=None&{expand}",
            )
        )

    probes.append(
        (
            "TrackedTimeReport groupBy=Client subGroupBy=Project",
            f"{TIME_ATTENDANCE}/TrackedTimeReport?{window_qs}&groupBy=Client&subGroupBy=Project&{expand}",
        )
    )

    probes.append(
        (
            "HourEntries (raw, first page) — duration format and total count",
            f"{TIME_TRACKING}/HourEntries?"
            + odata(
                count="true",
                filter=f"(date ge {frm} and date le {to})",
                orderby="date desc",
                top="5",
                select="id,personId,projectId,activityId,date,duration,status",
            ),
        )
    )

    # Breaks are why the clocked total looks impossible: the break button selects no
    # project, so break time lands in the same unassigned bucket as work logged without
    # one. "No project" therefore means "cannot tell", not "break" — and a published
    # figure should not rest on a habit nobody enforces. These two ask Jibble, which
    # knows what a break is.
    probes.append(
        (
            "TimeEntries — what `type` distinguishes a break",
            f"{TIME_TRACKING}/TimeEntries?"
            + odata(
                count="true",
                filter=f"(belongsToDate ge {frm} and belongsToDate le {to} and status ne 'Archived')",
                orderby="time desc",
                top="20",
                select="id,type,time,belongsToDate,personId,projectId,activityId",
            ),
        )
    )

    if person_ids:
        probes.append(
            (
                "TimesheetsSummary — worked vs break, per day, from Jibble itself",
                f"{TIME_ATTENDANCE}/TimesheetsSummary?"
                + urllib.parse.urlencode(
                    [("period", "Custom"), ("date", frm), ("endDate", to)]
                    + [("personIds", pid) for pid in person_ids]
                ),
            )
        )

    return probes


def candidate_figures(collected: dict[str, dict], frm: str, to: str) -> None:
    """Do the arithmetic, so numbers are read rather than worked out by hand.

    Uses `main.summarise_grouping`, so what prints here is what the site will publish.
    """
    import datetime as dt  # noqa: PLC0415

    print("=" * 78)
    print(f"CANDIDATE FIGURES  {frm} .. {to}")
    print("=" * 78)

    for dimension in ("Client", "Project", "Activity"):
        payload = collected.get(f"TrackedTimeReport groupBy={dimension}")
        if not payload:
            continue
        try:
            summary = summarise_grouping(payload.get("value") or [])
        except ValueError as err:
            print(f"{dimension}: could not summarise — {err}")
            continue
        print(
            f"{dimension:9} named={summary['named_count']}"
            f"  named_hours={summary['named_hours']:.1f}"
            f"  unassigned_hours={summary['unassigned_hours']:.1f}"
            f"  total={summary['total_hours']:.1f}"
        )

    member = collected.get("TrackedTimeReport groupBy=Member")
    if member:
        rows = member.get("value") or []
        total = sum(duration_to_hours(row["trackedTime"]) for row in rows)
        print(f"{'Member':9} people={len(rows)}  total_hours={total:.1f}")

    by_date = collected.get("TrackedTimeReport groupBy=Date")
    if by_date:
        rows = by_date.get("value") or []
        hours = [duration_to_hours(row["trackedTime"]) for row in rows]
        span = (dt.date.fromisoformat(to) - dt.date.fromisoformat(frm)).days + 1
        if hours:
            print(
                f"{'Date':9} days_worked={len(rows)} of {span} in window"
                f"  total_hours={sum(hours):.1f}"
                f"  longest_day={max(hours):.1f}"
                f"  mean_per_worked_day={sum(hours) / len(hours):.1f}"
            )
        else:
            print(f"{'Date':9} nothing tracked in the window")

    print()
    print("The unassigned figure above is break time *plus* anything logged without a")
    print("project; this endpoint cannot separate them. Check it against")
    print("TimesheetsSummary and TimeEntries.type before trusting it as 'breaks'.")
    print()
    print("Reminder: `billableAmount` is on every row above, and the groupings carry")
    print("names. Neither may reach `stats.json`.")
    print()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--days", type=int, default=WINDOW_DAYS, help=f"window length (default {WINDOW_DAYS})")
    parser.add_argument("--save", metavar="DIR", help="also write each raw response to DIR/<n>-<label>.json")
    parser.add_argument(
        "--env-file",
        default=DEFAULT_ENV_FILE,
        metavar="PATH",
        help="dotenv file to read credentials from (default: .env beside this script)",
    )
    args = parser.parse_args()

    load_env(args.env_file)

    api_key = os.environ.get("JIBBLE_API_KEY")
    api_secret = os.environ.get("JIBBLE_API_SECRET")
    if not api_key or not api_secret:
        raise SystemExit(
            f"JIBBLE_API_KEY and JIBBLE_API_SECRET are not set.\n"
            f"Looked in {args.env_file} and the environment.\n"
            "Jibble → Organization Settings → API Keys; the secret is shown once."
        )

    # Same window as the deployed function: trailing, ending yesterday.
    frm, to = window(args.days)
    print(f"window: {frm} .. {to}  ({args.days} days, ending yesterday)\n", file=sys.stderr)

    token = get_token(api_key, api_secret)
    print("token acquired\n", file=sys.stderr)

    if args.save:
        os.makedirs(args.save, exist_ok=True)

    # Fetched first because `TimesheetsSummary` takes `personIds` and has no
    # "everyone" form.
    person_ids = fetch_person_ids(token)
    print(f"person ids: {len(person_ids)}\n", file=sys.stderr)

    failures = 0
    collected: dict[str, dict] = {}

    for index, (label, url) in enumerate(build_probes(frm, to, person_ids), start=1):
        status, payload = api_get(url, token)
        report(label, url, status, payload)

        if status != 200:
            failures += 1
        elif isinstance(payload, dict):
            collected[label] = payload

        if args.save:
            slug = "".join(c if c.isalnum() else "-" for c in label).strip("-").lower()
            path = os.path.join(args.save, f"{index:02d}-{slug}.json")
            with open(path, "w", encoding="utf-8") as handle:
                json.dump({"label": label, "url": url, "status": status, "body": payload}, handle, indent=2, ensure_ascii=False)
            print(f"saved {path}", file=sys.stderr)

    candidate_figures(collected, frm, to)
    print(f"done — {failures} probe(s) returned a non-200", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
