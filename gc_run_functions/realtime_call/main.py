"""ヒーローの man に話しかけるための、通話開始だけを担う中継。

ブラウザが WebRTC の SDP offer を投げてくる。この関数はそれを OpenAI へ中継して、
返ってきた SDP answer をそのまま返す。**以降の音声はブラウザと OpenAI が直結**し、
ここは経路に入らない。だから仕事は「1回の HTTP を代理する」だけで、会話が何分続こうと
インスタンスは掴まれない。

    ブラウザ ──POST application/sdp──▶ この関数 ──▶ api.openai.com/v1/realtime/calls
                                        （API キーはここ。ブラウザには渡らない）
    ブラウザ ⇄ OpenAI が WebRTC で直結

> [!important] 一時トークン方式は採らなかった
> OpenAI には `client_secrets` を発行してブラウザから直接繋がせる道もある。使わない。
> **短命であれ、キーの類をブラウザに渡さずに済む**のがこの形の利点で、加えて
> `session`（モデル・`instructions`・音声）を**中継の瞬間にサーバ側で確定できる**。
> 濫用者にできるのは「会話を始めること」だけになる。

> [!warning] 依存を増やさないこと
> `requirements.txt` は `functions-framework` だけ。multipart を手で組んでいるのは
> そのため。`requests` や `openai` を入れた瞬間にコールドスタートが伸びる — この関数は
> 「話しかける」を押してから鳴るまでの待ち時間そのものなので、そこが効く。
> 標準ライブラリで足りている。

STUN も TURN も signaling サーバも要らない。SDP の交換がこの1往復で完結する。
"""

import json
import os
import secrets
import sys
import urllib.error
import urllib.parse
import urllib.request

# --------------------------------------------------------------------------- #
# 設定
# --------------------------------------------------------------------------- #

#: CORS を許す出どころ。`contact_form` と同じ理由で `www` も書く（GitHub Pages は
#: apex へ 301 するが、preflight は 301 を追わない）。
ALLOWED_ORIGINS = frozenset(
    {
        "https://faredgelabs.com",
        "https://www.faredgelabs.com",
        "http://localhost:3000",
    }
)

REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls"
REALTIME_TIMEOUT = 30

#: **モデル ID は動く。** ここを更新し忘れると、古い ID が消えた日に 404 で止まる。
#: 症状は「話しかけても無音」なので、まずここを疑うこと。
REALTIME_MODEL = "gpt-realtime-2.1"

#: 音声。**日本語での品質は未確認**（2026-09-10 時点）。既定ロケールが日本語なので、
#: 実際に喋らせて選び直すこと。読んで決められる類ではない。
REALTIME_VOICE = "marin"

#: SDP offer の上限。実際の offer は数 KB で、これは桁で言えば十分に緩い。
#: 上限が無いと 10MB の本文をそのまま上流へ中継してしまう。
MAX_SDP_BYTES = 64 * 1024

TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
TURNSTILE_TIMEOUT = 10

#: 通話を開始できなかったときにブラウザへ返す文言。**理由で出し分けない。**
#: キーの設定漏れ・モデル ID の失効・支出上限・上流の障害はどれも訪問者には同じ
#: 「いま話せない」で、切り分けの材料は Cloud Logging 側にしか無い。ここで詳しく
#: 返すと、公開エンドポイントが構成の状態を教えることになる。
CALL_FAILED = "通話を開始できませんでした"


# --------------------------------------------------------------------------- #
# CORS
# --------------------------------------------------------------------------- #


def _decode(raw: bytes) -> str:
    """上流の応答を文字列にする。**壊れたバイトで例外にしない。**

    ここに来るのは他所が作った本文で、こちらは中身を検査する立場にない。
    デコードで落ちると「上流が何を返したか」が分からないまま 500 になる。
    """
    return raw.decode("utf-8", errors="replace")


def allowed_origin(request) -> str | None:
    """許可された `Origin` か、許可されていなければ `None`。"""
    origin = request.headers.get("Origin")
    return origin if origin in ALLOWED_ORIGINS else None


def cors_headers(origin: str | None, content_type: str) -> dict[str, str]:
    """`contact_form` と違い `Content-Type` を引数で受ける。

    あちらは常に JSON だが、ここは**成功時が `application/sdp`、失敗時が JSON**。
    使い回すと SDP を JSON と名乗って返すことになり、ブラウザ側が黙って壊れる。
    """
    headers = {"Content-Type": content_type}
    if origin:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Vary"] = "Origin"
    return headers


def _error(message: str, status: int, origin: str | None):
    return (
        json.dumps({"error": message}, ensure_ascii=False),
        status,
        cors_headers(origin, "application/json; charset=utf-8"),
    )


# --------------------------------------------------------------------------- #
# Turnstile
# --------------------------------------------------------------------------- #


def verify_turnstile(token: str) -> bool:
    """人間かどうかを Cloudflare に聞く。

    > [!warning] `contact_form` と挙動が違う。fail **closed**
    > あちらは `TURNSTILE_SECRET` が未設定なら検証せず通す（ローカルをダミーキーで
    > 回すため）。ここは通さない。**素通しさせたときに出ていくのが金だから** —
    > あちらの最悪はスパムメール1通だが、ここは会話1本ぶんの推論費用が第三者に
    > 請求される。ローカルで動かすなら Cloudflare のテスト用シークレットを入れること。
    """
    secret = os.environ.get("TURNSTILE_SECRET")
    if not secret:
        print("TURNSTILE_SECRET が未設定。通話を拒否した", file=sys.stderr)
        return False

    request = urllib.request.Request(
        TURNSTILE_VERIFY_URL,
        data=urllib.parse.urlencode({"secret": secret, "response": token}).encode(),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        with urllib.request.urlopen(request, timeout=TURNSTILE_TIMEOUT) as response:
            payload = json.loads(_decode(response.read()))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as err:
        print(f"turnstile の検証に到達できなかった: {err}", file=sys.stderr)
        return False

    if not payload.get("success"):
        print(f"turnstile が拒否した: {payload.get('error-codes')}", file=sys.stderr)
        return False
    return True


# --------------------------------------------------------------------------- #
# セッション設定 — ここがサーバ側にある意味
# --------------------------------------------------------------------------- #


def build_instructions() -> str:
    """履歴書を根拠にした指示文。

    履歴書は `RESUME` 環境変数から来る（Secret Manager 経由）。**リポジトリには入って
    いない** — public なので `.gitignore` してある。ソース zip に同梱できないから
    Secret Manager を通す、というのがここの経路の理由。GCS から読む案もあるが、
    それだとクライアントライブラリが要って依存ゼロが崩れる。

    文面はまだ暫定。**何を答えさせるかは製品側の判断**で、技術的な制約ではない。
    """
    resume = os.environ.get("RESUME", "").strip()
    if not resume:
        # 履歴書が無いまま喋らせない。根拠を持たない状態で経歴を聞かれるのが
        # 一番まずい（もっともらしく作る）。
        raise KeyError("RESUME")

    return (
        "あなたは FarEdge Labs のサイトに置かれた案内役です。"
        "代表エンジニアの経歴について、下の資料に**書かれていることだけ**を根拠に答えます。\n"
        "\n"
        "- 資料に無いことは「資料には無い」と答える。**推測で補わない**\n"
        "- 料金・期間・受注可否は答えない。「お問い合わせフォームからご連絡ください」と案内する\n"
        "- 相手が使った言語で答える（日本語には日本語、英語には英語）\n"
        "- 簡潔に。聞かれていないことまで並べない\n"
        "\n"
        "--- 資料ここから ---\n"
        f"{resume}\n"
        "--- 資料ここまで ---"
    )


def build_session() -> dict:
    return {
        "type": "realtime",
        "model": REALTIME_MODEL,
        "instructions": build_instructions(),
        "audio": {"output": {"voice": REALTIME_VOICE}},
    }


# --------------------------------------------------------------------------- #
# 上流への中継
# --------------------------------------------------------------------------- #


def _multipart(sdp: bytes, session: dict) -> tuple[bytes, str]:
    """`sdp` と `session` の2フィールドを multipart/form-data に組む。

    手で組んでいる理由は冒頭の注記（依存を増やさない）。boundary は本文に現れない
    ことが要るので、推測不能な値にしている。
    """
    boundary = f"----faredge{secrets.token_hex(16)}"
    sep = f"--{boundary}\r\n".encode()

    body = b"".join(
        [
            sep,
            b'Content-Disposition: form-data; name="sdp"\r\n\r\n',
            sdp,
            b"\r\n",
            sep,
            b'Content-Disposition: form-data; name="session"\r\n',
            b"Content-Type: application/json\r\n\r\n",
            json.dumps(session, ensure_ascii=False).encode("utf-8"),
            b"\r\n",
            f"--{boundary}--\r\n".encode(),
        ]
    )
    return body, f"multipart/form-data; boundary={boundary}"


def relay_offer(sdp: bytes) -> str:
    """SDP offer を上流へ渡し、answer を返す。

    `sdp` は**一切加工しない。** WebRTC の交換相手はブラウザと OpenAI で、こちらは
    中身を解釈する立場にない。触ると通話が成立しなくなる。
    """
    api_key = os.environ["OPENAI_API_KEY"]
    body, content_type = _multipart(sdp, build_session())

    request = urllib.request.Request(
        REALTIME_CALLS_URL,
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": content_type,
        },
    )
    with urllib.request.urlopen(request, timeout=REALTIME_TIMEOUT) as response:
        return _decode(response.read())


# --------------------------------------------------------------------------- #
# エントリポイント
# --------------------------------------------------------------------------- #


def start_realtime_call(request):
    """HTTP エントリポイント。ブラウザが唯一の呼び手。

    層の順番は `contact_form` と同じくコスト順。Turnstile は外向きの HTTP を1本使うので、
    その前に無料で落とせるもの（メソッド、`Origin`、本文の大きさ）を先に落とす。
    """
    origin = allowed_origin(request)

    if request.method == "OPTIONS":
        headers = cors_headers(origin, "text/plain")
        headers.update(
            {
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                # ブラウザは SDP を本文に、Turnstile のトークンを**ヘッダ**に載せる。
                # 本文が JSON ではないので、トークンを混ぜる場所が本文に無い。
                "Access-Control-Allow-Headers": "Content-Type, X-Turnstile-Token",
                "Access-Control-Max-Age": "3600",
            }
        )
        return "", 204, headers

    if request.method != "POST":
        return _error("POST のみ受け付けます", 405, origin)

    if origin is None:
        return _error("許可されていない origin です", 403, origin)

    sdp = request.get_data()
    if not sdp:
        return _error("SDP offer がありません", 400, origin)
    if len(sdp) > MAX_SDP_BYTES:
        return _error("SDP offer が大きすぎます", 413, origin)

    if not verify_turnstile(request.headers.get("X-Turnstile-Token", "")):
        return _error("検証に失敗しました", 403, origin)

    try:
        answer = relay_offer(sdp)
    except KeyError as err:
        # `OPENAI_API_KEY` か `RESUME` が無い。設定漏れなので何が無いかは出す。
        print(f"必要な環境変数が設定されていない: {err}", file=sys.stderr)
        return _error(CALL_FAILED, 500, origin)
    except urllib.error.HTTPError as err:
        # **上流の本文はそのままログに出さない。** モデル ID が消えた、キーが失効した、
        # 支出上限に達した、のいずれもここに来る。status とエラー本文の先頭だけ残す。
        detail = _decode(err.read()[:500])
        print(f"OpenAI が {err.code} を返した: {detail}", file=sys.stderr)
        return _error(CALL_FAILED, 502, origin)
    except (urllib.error.URLError, TimeoutError) as err:
        print(f"OpenAI に到達できなかった: {err}", file=sys.stderr)
        return _error(CALL_FAILED, 502, origin)

    return answer, 200, cors_headers(origin, "application/sdp")


try:  # pragma: no cover - 直接実行したときは無い
    import functions_framework

    start_realtime_call = functions_framework.http(start_realtime_call)
except ImportError:
    # `contact_form` と同じ理由。関数単体は Framework 無しでも import して試せる。
    pass
