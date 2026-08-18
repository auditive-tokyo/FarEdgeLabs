"""お問い合わせフォームの受け口 — Cloud Run function。

ブラウザから直接叩かれる。`work_statistics` と違って**公開（`allUsers` に
`run.invoker`）が必須**で、そこがこの関数の設計を全部決めている。前段に認証がない
ので、防御はこのファイルの中にしかない。

    # ローカル、Functions Framework 越しに本番と同じ形で叩く
    functions-framework --target submit_contact_form --debug

    # 送信。`company` は任意で、他の3つは必須。
    curl -X POST http://localhost:8080 \
      -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' \
      -d '{"name":"テスト","email":"a@example.com","message":"本文","turnstileToken":"..."}'

**ファイル名は `main.py` でなければならない。** Python ランタイムの規則で、慣習では
ない。エントリポイント名は自由で、デプロイ時に `--entry-point` で指定する
（ここでは `submit_contact_form`）。

## 3層の防御

前は AWS Lambda + API Gateway + DynamoDB で動いていた。移植にあたって層を決め直した
もので、上から順に安い。

1. **Turnstile** — 連投してくるのはほぼボットなので、人間かどうかをここで落とす
2. **入力の上限** — 長さを見るだけ。SMTP に渡す前に切る
3. **失敗したときだけログ** — 成功時に本文を残さない

`Origin` の照合も入っているが、**これは防御ではない。** ブラウザ以外は `Origin` を
名乗らないか偽れるので、CORS は「他のサイトの JS から呼ばせない」だけの効果しかない。
数える層は上の3つ。

> [!important] IP レートリミットは検討して**落とした**。戻す前にこれを読む
> 一度は Firestore に TTL 付きで打刻を持ち、5分に3回で打ち切る層を書いた。消した
> 理由は、数字を出すと自分の主張が崩れたから。
>
> - **5分に3回は1日 864 通通る。** 本気の相手には効かない
> - **IP を分散されれば per-IP は素通り。** 分散は連投の自然な形
> - 残る効果は「Turnstile を通過した上での素朴なループ」と二重送信だけで、前者は
>   ほぼボットの領域 = Turnstile の担当
>
> 対して払っていたコストが、**プロジェクト全体の `roles/datastore.user`**
> （Firestore にはコレクション単位の IAM が無い）、Firestore が不調ならフォームが
> 止まる fail closed、`google-cloud-firestore` のぶんのコールドスタート、Terraform
> 資源3つ。低い確率のために恒久的な緩みを買っていた。
>
> **受け入れたリスク:** Turnstile を突破されると Zoho の日次送信上限が枯れる。その
> 状態では本物の問い合わせが黙って落ちるので、気づき方が「誰からも連絡が来ない」に
> なる。ただし送信失敗は3層目で Cloud Logging に出るので、ログを見れば分かる。
> 見張りが要るならログベースのアラートを足すのが順番で、レートリミットを戻すのは
> その次。
>
> 戻すのは難しくない。Firestore の location が変えられないのは**作った後**の話で、
> 後日 `asia-northeast1` に作るぶんには何の面倒もない。

## Lambda 版から意図的に変えたところ

- **`global _request_origin` を消した。** Lambda は1コンテナが1リクエストしか扱わない
  のでモジュール変数に置けたが、Cloud Run は既定で1インスタンスが同時に複数を捌く。
  並行した2件が互いの値を上書きして、**別のリクエストの
  `Access-Control-Allow-Origin` を返す**。リクエストに紐づく値は引数で渡す
- **DynamoDB のレートリミットを移植せず落とした。** 上の注記のとおり
- **`OPTIONS` に自分で答える。** API Gateway が捌いていたぶん
- **Subject に生の名前を入れるのをやめた。** `\r\n` を含む名前で SMTP ヘッダを注入
  できる（`Bcc:` を足せば踏み台になる）。`_single_line()` で落としている
- **SMTP に timeout を付けた。** 無しだと応答しない相手にインスタンスを掴まれる
- **毎リクエストの `print(json.dumps(event))` を消した。** 氏名・メール・本文が全部
  Cloud Logging に残っていた

> [!warning] ログに本文を書かない
> 3層目はそのための決定で、コードで守るしかない。デバッグ中に一度足した
> `print(payload)` が消し忘れられると、公開エンドポイントに入ってきた個人情報が
> 保持期間ぶん残る。長さや件数は出してよい。中身は出さない。
"""

from __future__ import annotations

import json
import os
import re
import smtplib
import sys
import urllib.error
import urllib.parse
import urllib.request
from email.message import EmailMessage

# --------------------------------------------------------------------------- #
# 設定
# --------------------------------------------------------------------------- #

#: CORS を許す出どころ。前は `auditive-tokyo.github.io` と Vite の 5173 だった。
#: いまは独自ドメインと Next の 3000。`www` は GitHub Pages が apex に 301 するが、
#: preflight は 301 を追わないので両方書く。
ALLOWED_ORIGINS = frozenset(
    {
        "https://faredgelabs.com",
        "https://www.faredgelabs.com",
        "http://localhost:3000",
    }
)

#: 入力の上限。254 は RFC 5321 のメールアドレスの最大長。
MAX_NAME_LENGTH = 100
MAX_EMAIL_LENGTH = 254
MAX_MESSAGE_LENGTH = 5000

#: 会社名の上限。**この項目だけ任意。** 法人からの問い合わせを想定しているので集めるが、
#: 個人や屋号で来る人を止める理由が無い。空でも欠けていても同じ扱い。
MAX_COMPANY_LENGTH = 100

TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
TURNSTILE_TIMEOUT = 10

SMTP_HOST = "smtp.zoho.jp"
SMTP_PORT = 465
SMTP_TIMEOUT = 20

#: ヘッダに入れてはいけない文字。改行だけでなく制御文字ごと落とす。
_CONTROL_CHARACTERS = re.compile(r"[\x00-\x1f\x7f]")


# --------------------------------------------------------------------------- #
# CORS
# --------------------------------------------------------------------------- #


def allowed_origin(request) -> str | None:
    """許可された `Origin` か、許可されていなければ `None`。

    照合しない場合に既定値へ落とさない。旧実装は許可外でも一覧の先頭を返していて、
    ブラウザから見ると「別のサイトが許可されている」という応答になっていた。返さな
    いほうが正しい。
    """
    origin = request.headers.get("Origin")
    return origin if origin in ALLOWED_ORIGINS else None


def cors_headers(origin: str | None) -> dict[str, str]:
    """引数で受けた origin だけを反映する。モジュール変数に置かない（冒頭の注記）。"""
    headers = {"Content-Type": "application/json; charset=utf-8"}
    if origin:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Vary"] = "Origin"
    return headers


# --------------------------------------------------------------------------- #
# 1層目: Turnstile
# --------------------------------------------------------------------------- #


def verify_turnstile(token: str) -> bool:
    """Cloudflare に人間かどうかを聞く。

    `TURNSTILE_SECRET` が未設定なら**検証せず通す**。理由は開発用のダミーキーで
    ローカルを回せるようにするためで、**本番で未設定にすると防御が1層も残らない** —
    レートリミットを落としたので、ここを通すと素通しになる。Terraform が
    Secret Manager から必ず注入するので、抜けるのは手で作った環境だけ。

    秘密が設定されていて Cloudflare が応えないときは通さない。設定した意図のほうを
    尊重する。

    `remoteip` は**渡さない。** 任意のパラメータで、渡すなら正しい IP でなければ
    Cloudflare の判定を狂わせる側に働く。Cloud Run は受け取った
    `X-Forwarded-For` に追記するので鎖の左側は自称、右端が客なのか経路の1ホップなの
    かは構成次第で、確定させるには実測が要る。**その実測はレートリミットのために
    やる作業だった。** 落としたので、間違った値を渡すより省くほうが正しい。
    """
    secret = os.environ.get("TURNSTILE_SECRET")
    if not secret:
        return True

    body = {"secret": secret, "response": token}

    request = urllib.request.Request(
        TURNSTILE_VERIFY_URL,
        data=urllib.parse.urlencode(body).encode(),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        with urllib.request.urlopen(request, timeout=TURNSTILE_TIMEOUT) as response:
            payload = json.loads(response.read().decode("utf-8", errors="replace"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as err:
        print(f"turnstile の検証に到達できなかった: {err}", file=sys.stderr)
        return False

    if not payload.get("success"):
        # `error-codes` に本文は入らない。入るのは `invalid-input-response` などの
        # 定数だけなので、これはログに出してよい。
        print(f"turnstile が拒否した: {payload.get('error-codes')}", file=sys.stderr)
        return False
    return True


# --------------------------------------------------------------------------- #
# 2層目: 入力
# --------------------------------------------------------------------------- #


#: 必須の項目と上限。
REQUIRED_LIMITS = {
    "name": MAX_NAME_LENGTH,
    "email": MAX_EMAIL_LENGTH,
    "message": MAX_MESSAGE_LENGTH,
}

#: 任意の項目と上限。空・空白のみ・キーが無い、のどれでも「無し」として通す。
OPTIONAL_LIMITS = {
    "company": MAX_COMPANY_LENGTH,
}


def parse_submission(payload: object) -> tuple[dict[str, str] | None, str | None]:
    """`(値, エラー)` を返す。片方だけが `None` になる。

    長さは SMTP に渡す前に見る。上限を超えたものを切って送るのではなく落とす —
    切ると送信者は全部送れたつもりのままになる。**任意の項目も長さは見る**: 任意なのは
    「無くてもよい」であって「何を入れてもよい」ではない。

    返る辞書に `company` が入るのは値があったときだけ。空文字を入れて返さないのは、
    呼び出し側が `if fields.get("company")` の1つで判断できるようにするため。
    """
    if not isinstance(payload, dict):
        return None, "リクエストの本文が JSON オブジェクトではありません"

    fields: dict[str, str] = {}

    for field, limit in REQUIRED_LIMITS.items():
        value = payload.get(field)
        if not isinstance(value, str) or not value.strip():
            return None, f"{field} が入っていません"
        value = value.strip()
        if len(value) > limit:
            return None, f"{field} が長すぎます（上限 {limit} 文字）"
        fields[field] = value

    for field, limit in OPTIONAL_LIMITS.items():
        value = payload.get(field)
        if not isinstance(value, str) or not value.strip():
            continue
        value = value.strip()
        if len(value) > limit:
            return None, f"{field} が長すぎます（上限 {limit} 文字）"
        fields[field] = value

    if not email_shaped(fields["email"]):
        return None, "メールアドレスの形式が正しくありません"

    return fields, None


def email_shaped(value: str) -> bool:
    """打ち間違いと明らかなゴミを弾くだけ。**RFC の検証ではない。**

    正規表現をやめて手で分解している。`^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$` は素直だが、
    `+` が3つ隣り合っていて後戻りが指数的に効く形（ReDoS）。長さを 254 に制限して
    あるので実害は出にくいが、**入力の上限が防御になっているという構造にしたくない**
    ので形を変えた。こちらは1回走るだけで終わる。

    本当に届くかは送ってみるまで分からない。だから厳しくしても得がなく、
    `a@b.c` を通す程度で足りる。
    """
    if any(character.isspace() for character in value):
        return False

    local, separator, domain = value.partition("@")
    if not separator or not local or "@" in domain:
        return False

    labels = domain.split(".")
    return len(labels) >= 2 and all(labels)


# --------------------------------------------------------------------------- #
# 送信
# --------------------------------------------------------------------------- #


def _single_line(value: str, limit: int = 200) -> str:
    """ヘッダに入れられる形にする。

    **これはヘッダ注入対策。** `名前\\r\\nBcc: someone@example.com` を Subject に
    入れられると、このフォームが第三者への送信手段になる。`EmailMessage` が弾く場合
    もあるが、依存しない — 弾くかどうかがヘッダとポリシーで変わる。
    """
    return _CONTROL_CHARACTERS.sub(" ", value)[:limit].strip()


def send_email(fields: dict[str, str]) -> None:
    """Zoho 経由で1通送る。失敗は例外のまま上げる。"""
    sender = os.environ["SENDER_EMAIL"]
    receiver = os.environ["RECEIVER_EMAIL"]
    password = os.environ["APP_PASSWORD"]

    company = fields.get("company")

    message = EmailMessage()
    message["From"] = sender
    message["To"] = receiver
    # 会社名があれば件名に入れる。受信箱の一覧で誰から来たのかが分かるのが、この項目を
    # 集めている一番の理由なので、本文の中だけに置いても半分しか役に立たない。
    # `_single_line` を通すのは注入対策で、任意の項目でも例外にしない。
    who = _single_line(fields["name"], 80)
    if company:
        who = f"{_single_line(company, 80)} / {who}"
    message["Subject"] = f"FarEdge Labs お問い合わせ: {who}"

    # Reply-To を送信者にすると通知メールからそのまま返信できる。ここも生では入れない。
    message["Reply-To"] = _single_line(fields["email"], MAX_EMAIL_LENGTH)

    # 会社名の行は値があるときだけ。中身の無い見出しだけの行は読み手を迷わせる。
    message.set_content(
        (f"会社名: {company}\n" if company else "")
        + f"名前: {fields['name']}\n"
        + f"メール: {fields['email']}\n\n"
        + f"本文:\n{fields['message']}\n"
    )

    # timeout なしだと、応答しない相手にインスタンスをリクエストタイムアウトまで
    # 掴まれる。同時実行数のぶんだけ詰まる。
    with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=SMTP_TIMEOUT) as server:
        server.login(sender, password)
        server.send_message(message)


# --------------------------------------------------------------------------- #
# エントリポイント
# --------------------------------------------------------------------------- #


def _json(body: dict, status: int, origin: str | None):
    return body, status, cors_headers(origin)


def submit_contact_form(request):
    """HTTP エントリポイント。ブラウザが唯一の呼び手。

    層の順番はコストの順。Turnstile は外向きの HTTP を1本使うので、**その前に無料で
    落とせるものを全部落とす**（メソッド、`Origin`、JSON として読めるか、長さ）。
    """
    origin = allowed_origin(request)

    if request.method == "OPTIONS":
        headers = cors_headers(origin)
        headers.update(
            {
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Max-Age": "3600",
            }
        )
        return "", 204, headers

    if request.method != "POST":
        return _json({"success": False, "message": "POST のみ受け付けます"}, 405, origin)

    if origin is None:
        return _json({"success": False, "message": "許可されていない origin です"}, 403, origin)

    payload = request.get_json(silent=True)
    fields, error = parse_submission(payload)
    if error or fields is None:
        return _json({"success": False, "message": error}, 400, origin)

    # トークンは `parse_submission` が返す3項目には入らない（必須の入力ではなく、
    # 検証の材料なので）。ここで生の本文から取る。
    token = payload.get("turnstileToken")
    if not verify_turnstile(token if isinstance(token, str) else ""):
        return _json({"success": False, "message": "検証に失敗しました"}, 403, origin)

    try:
        send_email(fields)
    except KeyError as err:
        # `os.environ[...]` が無い。設定漏れなので、何が無いかは出す。
        print(f"必要な環境変数が設定されていない: {err}", file=sys.stderr)
        return _json({"success": False, "message": "送信できませんでした"}, 500, origin)
    except (smtplib.SMTPException, OSError) as err:
        # 3層目。本文は残さない。長さだけ出せば、届かなかったことと規模は分かる。
        #
        # **Zoho の日次送信上限が枯れたときもここに出る。** レートリミットを落とした
        # ぶん、荒らされたことに気づく唯一の場所がこの行になった。見張るなら
        # ログベースのアラートをこの文言に張るのが順番。
        print(
            f"メールを送信できなかった: {type(err).__name__}: {err} "
            f"(name={len(fields['name'])}, message={len(fields['message'])} 文字)",
            file=sys.stderr,
        )
        return _json({"success": False, "message": "送信できませんでした"}, 500, origin)

    return _json({"success": True, "message": "送信しました"}, 200, origin)


try:  # pragma: no cover - 直接実行したときは無い
    import functions_framework

    submit_contact_form = functions_framework.http(submit_contact_form)
except ImportError:
    # `work_statics/main.py` と同じ理由で生かしてある。関数単体は Framework 無しでも
    # import して試せる。
    pass
