"""Work statistics for the hero panel — the deployed Cloud Run function.

Cloud Scheduler calls this once a day. It asks Jibble for the trailing window,
reduces the answer to three numbers, and writes `stats.json` to a public Cloud
Storage object that the site fetches. Nothing else reads it and nothing else writes
it.

**The file must be called `main.py`.** That is the runtime's rule for Python, not a
convention — "Cloud Run loads source code from a file named main.py at the root of
your function directory". The *entry point* name is free, unlike Lambda's
`lambda_handler`: it is whatever function is registered with the Functions Framework
and named with `--entry-point` at deploy time. Here that is
`refresh_work_statistics`.

    # local, against the real API, printing instead of writing
    python3 main.py

    # local, serving the HTTP entry point the way Scheduler will call it
    functions-framework --target refresh_work_statistics --debug

Local runs read `.env` beside this file via `python-dotenv`, which is in
`requirements-dev.txt` and imported lazily — deployed, the credentials arrive from
Secret Manager and there is no `.env` in the container.

`probe.py` beside this file dumps raw responses for inspection. It imports from
here rather than reimplementing, because the two places a wrong-but-plausible number
comes from — parsing durations and excluding the unassigned bucket — must have one
implementation. A probe that agrees with a private copy of the logic proves nothing.

> [!warning] What must never reach `stats.json`
> Every report row carries `billableAmount`, and the groupings carry client and
> project **names**. The panel publishes counts and a total. Adding a field here is
> adding it to a public URL.
"""

from __future__ import annotations

import datetime as dt
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from zoneinfo import ZoneInfo

IDENTITY_URL = "https://identity.prod.jibble.io/connect/token"
WORKSPACE = "https://workspace.prod.jibble.io/v1"
TIME_ATTENDANCE = "https://time-attendance.prod.jibble.io/v1"
TIME_TRACKING = "https://time-tracking.prod.jibble.io/v1"

TIMEOUT = 30

#: Length of the trailing window, in whole days.
WINDOW_DAYS = 30

#: Which clock decides what "yesterday" means.
#:
#: **Not the container's.** Cloud Run runs in UTC, so `date.today()` there is up to
#: nine hours behind the operator's calendar — schedule the job for the JST morning
#: and UTC still says yesterday, shifting the whole window back a day and putting the
#: site's figures permanently out of step with the Jibble dashboard. Developing on a
#: JST laptop hides this completely: it only appears once deployed.
WINDOW_TIMEZONE = os.environ.get("WINDOW_TIMEZONE", "Asia/Tokyo")

#: How long a browser and Cloud Storage may keep a copy. GCS serves a public object
#: with `public, max-age=3600` when the header is absent, so a fresh write can read
#: stale for an hour whatever the schedule says. Set deliberately rather than
#: inherited.
CACHE_CONTROL = "public, max-age=1800"


# --------------------------------------------------------------------------- #
# Durations
# --------------------------------------------------------------------------- #

_DURATION = re.compile(
    r"^P(?!$)"
    r"(?:(?P<years>\d+)Y)?"
    r"(?:(?P<months>\d+)M)?"
    r"(?:(?P<weeks>\d+)W)?"
    r"(?:(?P<days>\d+)D)?"
    r"(?:T(?!$)"
    r"(?:(?P<hours>\d+)H)?"
    r"(?:(?P<minutes>\d+)M)?"
    r"(?:(?P<seconds>\d+(?:\.\d+)?)S)?"
    r")?$"
)


def duration_to_hours(value: str) -> float:
    """`P12DT8H5M36.741321S` -> 296.0935…

    Jibble returns ISO 8601 durations and the standard library cannot read them:
    `datetime` has no parser and `timedelta` has no constructor for the format.

    **`D` is a literal 24 hours, not a working day.** `P12D` over a month is 288
    hours, which is what makes the per-member total agree with the sum of the
    per-date rows. Reading it as "12 days of work" reports a twelfth of the figure —
    and a twelfth of a plausible number is still plausible.

    Years and months are refused rather than approximated. Neither has a fixed length
    in hours, and a report over a 30-day window has no business emitting them; if one
    ever appears that is a finding, not something to paper over with 30.44.
    """
    match = _DURATION.match(value)
    if not match:
        raise ValueError(f"not an ISO 8601 duration: {value!r}")

    parts = match.groupdict()
    if parts["years"] or parts["months"]:
        raise ValueError(f"duration has no fixed length in hours: {value!r}")

    def num(name: str) -> float:
        return float(parts[name]) if parts[name] else 0.0

    return (
        num("weeks") * 7 * 24
        + num("days") * 24
        + num("hours")
        + num("minutes") / 60
        + num("seconds") / 3600
    )


# --------------------------------------------------------------------------- #
# HTTP
# --------------------------------------------------------------------------- #


def _request(url: str, *, data: bytes | None = None, headers: dict[str, str] | None = None):
    """One request, returning `(status, payload)` and never raising on HTTP status.

    Jibble puts the reason for a 4xx in the response *body*, which `urllib` raises
    away. Reading the error body and returning it like any other payload is what makes
    a failure in Cloud Logging say what went wrong rather than just "400".

    `Accept: application/json` is set here rather than by each caller. Every request
    this module makes goes to Jibble and wants JSON back, so repeating it at the call
    sites was duplication with nothing to say — a caller can still override it, since
    its headers are merged on top.
    """
    req = urllib.request.Request(
        url, data=data, headers={"Accept": "application/json", **(headers or {})}
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as res:
            return res.status, _decode(res.read())
    except urllib.error.HTTPError as err:
        return err.code, _decode(err.read())
    except urllib.error.URLError as err:
        return 0, {"transport_error": str(err.reason)}


def _decode(raw: bytes):
    text = raw.decode("utf-8", errors="replace")
    if not text:
        return None
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {"non_json_body": text[:2000]}


def get_token(api_key: str, api_secret: str) -> str:
    """Client-credentials grant.

    Jibble's dashboard labels the pair "API Key ID" and "API Key Secret"; OAuth2 calls
    them `client_id` and `client_secret`. The environment uses Jibble's names — the
    place you go to read the values — and the mapping happens here, once.
    """
    body = urllib.parse.urlencode(
        {
            "grant_type": "client_credentials",
            "client_id": api_key,
            "client_secret": api_secret,
        }
    ).encode()

    status, payload = _request(
        IDENTITY_URL,
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    if status != 200 or not isinstance(payload, dict) or "access_token" not in payload:
        raise RuntimeError(f"Jibble token request failed ({status}): {payload}")
    return payload["access_token"]


def api_get(url: str, token: str):
    return _request(url, headers={"Authorization": f"Bearer {token}"})


def tracked_time_report(token: str, frm: str, to: str, group_by: str) -> list[dict]:
    """One grouping of the trailing window.

    `$expand=Subject` is what makes the grouped-by entity come back as an object with
    a name rather than a bare id — which matters only for telling the unassigned
    bucket apart, since no name is published.
    """
    query = (
        f"from={frm}&to={to}&groupBy={group_by}&subGroupBy=None"
        "&$expand=" + urllib.parse.quote("Subject,Items($expand=Subject)", safe="$(),")
    )
    status, payload = api_get(f"{TIME_ATTENDANCE}/TrackedTimeReport?{query}", token)
    if status != 200 or not isinstance(payload, dict):
        raise RuntimeError(f"TrackedTimeReport groupBy={group_by} failed ({status}): {payload}")
    return payload.get("value") or []


# --------------------------------------------------------------------------- #
# Aggregation
# --------------------------------------------------------------------------- #


def summarise_grouping(rows: list[dict]) -> dict[str, float | int]:
    """Split a grouping into real groups and the unassigned one.

    The report always returns a bucket for "nothing attached", and it arrives as a
    row like any other — `id: ""` with `subject.name: null`. It is not omitted and not
    flagged, so **counting rows reports two clients where there is one.** Getting this
    wrong produces a number that is off by exactly one and looks entirely reasonable
    on the page.

    For hours, that bucket is where **break time** lands: pressing the break button
    selects no project. It is therefore excluded from the published total — 296 hours
    a month is clocked time, not worked time.

    The caveat, written down because it will not be obvious later: "no project" means
    "we cannot tell", not "break". Work logged without selecting a project is counted
    as break by this rule and disappears. That is acceptable while every piece of
    client work carries a project, and it is the reason `probe.py` also asks
    `TimesheetsSummary` for Jibble's own worked-versus-break split — if that figure
    agrees, prefer it, because it does not depend on a habit.
    """
    named_hours = 0.0
    named_count = 0
    unassigned_hours = 0.0

    for row in rows:
        hours = duration_to_hours(row["trackedTime"])
        subject = row.get("subject") or {}
        if not row.get("id") and not subject.get("name"):
            unassigned_hours += hours
        else:
            named_count += 1
            named_hours += hours

    return {
        "named_count": named_count,
        "named_hours": named_hours,
        "unassigned_hours": unassigned_hours,
        "total_hours": named_hours + unassigned_hours,
    }


def local_today(timezone: str = WINDOW_TIMEZONE) -> dt.date:
    """Today in the operator's timezone, not the container's. See `WINDOW_TIMEZONE`."""
    return dt.datetime.now(ZoneInfo(timezone)).date()


def window(days: int = WINDOW_DAYS, today: dt.date | None = None) -> tuple[str, str]:
    """The trailing window, **ending yesterday**.

    Two reasons not to include today. The figure would climb through the day, so two
    visitors an hour apart see different numbers from the same daily refresh. And today
    is a partial day: counting it drags the average down every morning for no reason a
    reader could see.
    """
    today = today or local_today()
    end = today - dt.timedelta(days=1)
    start = end - dt.timedelta(days=days - 1)
    return start.isoformat(), end.isoformat()


def collect(token: str, days: int = WINDOW_DAYS) -> dict:
    """The three published figures, plus the workings that justify them.

    `Activity` is fetched although nothing uses activities yet — every hour currently
    lands in its unassigned bucket, so `activities` is 0. Keeping the call means the
    day activities start being used, the number is already there and only a label is
    missing.
    """
    frm, to = window(days)

    clients = summarise_grouping(tracked_time_report(token, frm, to, "Client"))
    projects = summarise_grouping(tracked_time_report(token, frm, to, "Project"))
    activities = summarise_grouping(tracked_time_report(token, frm, to, "Activity"))
    dates = tracked_time_report(token, frm, to, "Date")

    # Days with nothing tracked are omitted from the response rather than returned as
    # a zero, so the row count *is* the number of days worked.
    days_worked = len(dates)

    return {
        "window": {"from": frm, "to": to, "days": days, "timezone": WINDOW_TIMEZONE},
        "generatedAt": dt.datetime.now(dt.timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z"),
        "clients": clients["named_count"],
        "projects": projects["named_count"],
        "activities": activities["named_count"],
        "hours": round(clients["named_hours"], 1),
        "daysWorked": days_worked,
        # Kept because "why is the site's number lower than Jibble's?" is a question
        # that will be asked, and this is the answer. Break time plus anything logged
        # without a project.
        "excludedHours": round(clients["unassigned_hours"], 1),
    }


# --------------------------------------------------------------------------- #
# Output
# --------------------------------------------------------------------------- #


def write_to_bucket(payload: dict, bucket_name: str, object_name: str) -> None:
    """Write `stats.json`, with `Cache-Control` set rather than inherited.

    Imported here, not at module scope: `python3 main.py` runs against the real API
    without touching Cloud Storage, and should not need the client library installed
    to do it.
    """
    from google.cloud import storage  # noqa: PLC0415

    blob = storage.Client().bucket(bucket_name).blob(object_name)
    blob.cache_control = CACHE_CONTROL
    blob.upload_from_string(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        content_type="application/json",
    )


def credentials() -> tuple[str, str]:
    api_key = os.environ.get("JIBBLE_API_KEY")
    api_secret = os.environ.get("JIBBLE_API_SECRET")
    if not api_key or not api_secret:
        raise RuntimeError("JIBBLE_API_KEY and JIBBLE_API_SECRET are not set")
    return api_key, api_secret


DEFAULT_ENV_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")


def load_env(path: str = DEFAULT_ENV_FILE) -> None:
    """Local development only — deployed, the secrets arrive from Secret Manager.

    Imported inside the function so `python-dotenv` can live in
    `requirements-dev.txt`: the container has no `.env` to read, and a dependency that
    can never run in production has no business in the production manifest. Nothing on
    the deployed path calls this.

    `load_dotenv` does not override existing variables, so `JIBBLE_API_KEY=other
    python3 main.py` still wins over the file.
    """
    try:
        from dotenv import load_dotenv  # noqa: PLC0415
    except ImportError:
        raise SystemExit(
            "python-dotenv is not installed — it is a dev dependency:\n"
            "  python3 -m venv .venv && source .venv/bin/activate\n"
            "  pip install -r requirements.txt -r requirements-dev.txt\n"
            "or export JIBBLE_API_KEY and JIBBLE_API_SECRET yourself."
        ) from None

    if load_dotenv(path):
        print(f"loaded {path}", file=sys.stderr)


# --------------------------------------------------------------------------- #
# Entry point
# --------------------------------------------------------------------------- #


def refresh_work_statistics(request):
    """HTTP entry point. Cloud Scheduler is the only caller.

    The name is arbitrary — it is registered with `--entry-point` at deploy time.
    Only the *file* name is fixed by the runtime.

    **This must be deployed with authentication required**, with `run.invoker` granted
    to the Scheduler job's service account and nothing else. An unauthenticated URL
    here still looks like it is working, while strangers spend the Jibble rate limit
    and the figures quietly stop moving.

    Returns the payload so a manual invocation shows what was written, and a non-2xx
    on failure so Scheduler's own retry sees it.
    """
    del request  # no input: the window is derived from the clock

    bucket_name = os.environ.get("STATS_BUCKET")
    object_name = os.environ.get("STATS_OBJECT", "stats.json")

    try:
        api_key, api_secret = credentials()
        payload = collect(get_token(api_key, api_secret))
    except (RuntimeError, ValueError, KeyError) as err:
        print(f"refresh failed before writing: {err}", file=sys.stderr)
        return ({"ok": False, "error": str(err)}, 500)

    if not bucket_name:
        print("STATS_BUCKET is not set; computed but did not write", file=sys.stderr)
        return ({"ok": False, "error": "STATS_BUCKET is not set", "stats": payload}, 500)

    try:
        write_to_bucket(payload, bucket_name, object_name)
    except Exception as err:  # noqa: BLE001 - the write is the last step; report and fail
        print(f"computed but could not write gs://{bucket_name}/{object_name}: {err}", file=sys.stderr)
        return ({"ok": False, "error": str(err), "stats": payload}, 500)

    print(f"wrote gs://{bucket_name}/{object_name}: {json.dumps(payload)}")
    return ({"ok": True, "stats": payload}, 200)


try:  # pragma: no cover - absent when running this file directly
    import functions_framework

    refresh_work_statistics = functions_framework.http(refresh_work_statistics)
except ImportError:
    # Deliberately survivable. `python3 main.py` and `probe.py` exercise the real
    # logic against the real API, and neither needs the framework installed to do it.
    pass


if __name__ == "__main__":
    load_env()
    print(json.dumps(collect(get_token(*credentials())), indent=2, ensure_ascii=False))
