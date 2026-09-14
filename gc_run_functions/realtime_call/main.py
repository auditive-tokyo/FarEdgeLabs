"""ヒーローの man に話しかけるための、通話開始だけを担う中継。

ブラウザが WebRTC の SDP offer を投げてくる。この関数はそれを OpenAI へ中継して、
返ってきた SDP answer をそのまま返す。**以降の音声はブラウザと OpenAI が直結**し、
ここは経路に入らない。だから仕事は「1回の HTTP を代理する」だけで、会話が何分続こうと
インスタンスは掴まれない。

    ブラウザ ──POST {"sdp"}──▶ この関数 ──▶ api.openai.com/v1/live/sessions
                                  （API キーはここ。ブラウザには渡らない）
    ブラウザ ⇄ OpenAI が WebRTC で直結

> [!important] 一時トークン方式は採らなかった
> OpenAI には `client_secrets` を発行してブラウザから直接繋がせる道もある。使わない。
> **短命であれ、キーの類をブラウザに渡さずに済む**のがこの形の利点で、加えて
> `session`（モデル・`instructions`・音声）を**中継の瞬間にサーバ側で確定できる**。
> 濫用者にできるのは「会話を始めること」だけになる。

> [!warning] 依存を増やさないこと
> `requirements.txt` は `functions-framework` だけ。`requests` や `openai` を入れた
> 瞬間にコールドスタートが伸びる — この関数は「話しかける」を押してから鳴るまでの
> 待ち時間そのものなので、そこが効く。標準ライブラリで足りている。

STUN も TURN も signaling サーバも要らない。SDP の交換がこの1往復で完結する。
"""

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

from instruction import BACKEND_INSTRUCTIONS, VOICE_INSTRUCTIONS

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

LIVE_SESSIONS_URL = "https://api.openai.com/v1/live/sessions"
LIVE_TIMEOUT = 30

#: **モデル ID は動く。** ここを更新し忘れると、古い ID が消えた日に 404 で止まる。
#: 症状は「話しかけても無音」なので、まずここを疑うこと。
#:
#: ## 2つのモデルに分かれている理由
#:
#: `gpt-live-1` は**喋ることだけ**を担う全二重の音声モデルで、知識と推論は
#: `delegation` で背後のモデルへ投げる。以前は `gpt-realtime-2.1-mini` 1つに
#: 「全部知っている」と「自然に短く喋る」を同時にやらせていて、**長々と喋るのは
#: その構造が原因**だった。音声層が会社案内を読んでいなければ、読み上げようがない。
#:
#: ## 値段
#:
#: 音声層は **$0.05/分（秒課金）**。`gpt-realtime-2.1-mini` の実効 $0.027/分より
#: **高い**（2026-09-15 時点で確認）。安くするための変更ではなく、全二重と委譲を
#: 買う変更。戻す判断をするときはここを見ること。
#: バックエンドは別課金で、Luna は in $0.20 / cached $0.02 / out $1.20 per 1M。
LIVE_MODEL = "gpt-live-1"

#: 委譲先。**一番安い層で足りる**という判断。ここがやるのは、渡された資料から
#: 答えを探して会話向けに短くまとめることだけで、難しい推論は要らない。
#: 足りなければ `gpt-5.6-terra`（in $2.00 / out $12.00）へ上げる。
BACKEND_MODEL = "gpt-5.6-luna"

#: 音声。被写体が男性なので男性の声から選ぶ:
#: `ripple` `vesper` `stone` `meridian` `tempo` `beacon` `cinder`
#:
#: > [!warning] フィールドの位置が未確認
#: > 公式のセッション設定例に `voice` が出てこない。Realtime 2.x と同じ
#: > `audio.output.voice` に置いてあるが、**裏は取れていない**。外れていれば上流が
#: > 400 を返し、エラー本文の先頭500文字が Cloud Logging に出る（`start_realtime_call`
#: > の `HTTPError` 節）。そこにフィールド名が書いてあるはず。
LIVE_VOICE = "vesper"

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
#
# モデル・音声・`instructions` は**中継の瞬間にサーバで組む**。ブラウザは SDP しか
# 送ってこないので、訪問者がモデルを差し替えたり指示文を書き換えたりする経路が無い。
# 原稿は `instruction.py`。
# --------------------------------------------------------------------------- #


def build_session() -> dict:
    """音声層と委譲先の設定を1つにまとめる。

    `instructions` が2つあるのが要点。**喋り方の規則は音声層、根拠の規則は委譲先**で、
    以前1つのプロンプトに同居して互いを薄めていたものを分けてある（`instruction.py`）。
    """
    return {
        "model": LIVE_MODEL,
        "instructions": VOICE_INSTRUCTIONS,
        "audio": {"output": {"voice": LIVE_VOICE}},
        "delegation": {
            "type": "responses",
            "responses": {
                "model": BACKEND_MODEL,
                # 資料は `BACKEND_INSTRUCTIONS` に積んである。**`tools` は渡さない** —
                # `file_search` を入れて本番で 502 を踏んだ（`instruction.py` の注記）。
                # Live の委譲で使えるのは `function` と `web_search` だけ。
                "instructions": BACKEND_INSTRUCTIONS,
            },
        },
    }


def relay_offer(sdp: str) -> str:
    """SDP offer を上流へ渡し、answer を返す。

    `sdp` は**一切加工しない。** WebRTC の交換相手はブラウザと OpenAI で、こちらは
    中身を解釈する立場にない。触ると通話が成立しなくなる。
    """
    api_key = os.environ["OPENAI_API_KEY"]
    payload = {
        "session": build_session(),
        "transport": {"type": "webrtc", "sdp": sdp},
    }

    request = urllib.request.Request(
        LIVE_SESSIONS_URL,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(request, timeout=LIVE_TIMEOUT) as response:
        body = json.loads(_decode(response.read()))

    # 201 が返っても中身が期待の形とは限らない。`KeyError` にせず、呼び出し側が
    # 502 に落とせる形で投げる。
    answer = body.get("transport", {}).get("sdp")
    if not answer:
        raise ValueError(f"answer が無い応答: {json.dumps(body)[:300]}")
    return answer


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
                # Turnstile のトークンは**ヘッダ**のまま。本文が JSON になったので
                # 混ぜる場所はできたが、動かす理由が無い — `application/json` も
                # カスタムヘッダも等しく preflight を起こすので、速くもならない。
                "Access-Control-Allow-Headers": "Content-Type, X-Turnstile-Token",
                "Access-Control-Max-Age": "3600",
            }
        )
        return "", 204, headers

    if request.method != "POST":
        return _error("POST のみ受け付けます", 405, origin)

    if origin is None:
        return _error("許可されていない origin です", 403, origin)

    # 大きさは**パースの前に**見る。JSON を解いてから測ると、10MB の本文を一度
    # メモリに展開したあとで捨てることになる。
    raw = request.get_data()
    if len(raw) > MAX_SDP_BYTES:
        return _error("SDP offer が大きすぎます", 413, origin)

    try:
        sdp = json.loads(raw).get("sdp", "")
    except (ValueError, AttributeError):
        return _error("本文が JSON ではありません", 400, origin)
    if not isinstance(sdp, str) or not sdp:
        return _error("SDP offer がありません", 400, origin)

    if not verify_turnstile(request.headers.get("X-Turnstile-Token", "")):
        return _error("検証に失敗しました", 403, origin)

    try:
        answer = relay_offer(sdp)
    except KeyError as err:
        # `OPENAI_API_KEY` が無い。設定漏れなので何が無いかは出す。
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
    except ValueError as err:
        # 201 は返ったが answer が取り出せなかった。応答の形が変わった可能性。
        print(f"OpenAI の応答を解釈できなかった: {err}", file=sys.stderr)
        return _error(CALL_FAILED, 502, origin)

    return answer, 200, cors_headers(origin, "application/sdp")


try:  # pragma: no cover - 直接実行したときは無い
    import functions_framework

    start_realtime_call = functions_framework.http(start_realtime_call)
except ImportError:
    # `contact_form` と同じ理由。関数単体は Framework 無しでも import して試せる。
    pass
