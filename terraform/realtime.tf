# --------------------------------------------------------------------------- #
# ヒーローの man に話しかけるための、通話開始の中継
#
# 関数の仕事は SDP offer を OpenAI へ中継して answer を返すだけ。**音声はブラウザと
# OpenAI が直結**するので、この関数は経路に入らず、会話が何分続いてもインスタンスを
# 掴まない。詳細は `gc_run_functions/realtime_call/main.py` の冒頭。
# --------------------------------------------------------------------------- #

locals {
  # このファイルで作るシークレット。**`TURNSTILE_SECRET` はここに無い** — `contact.tf`
  # が作ったものを共有する。同じ Cloudflare サイトの対なので、分ける理由が無い。
  realtime_secrets = {
    OPENAI_API_KEY = "openai-api-key"
  }

  realtime_call_src = "${path.module}/../gc_run_functions/realtime_call"
}

resource "google_secret_manager_secret" "realtime" {
  for_each = local.realtime_secrets

  secret_id = each.value

  replication {
    auto {}
  }

  depends_on = [google_project_service.enabled]
}

# > [!important] 値は Terraform を通さない。手で入れる
# > `google_secret_manager_secret_version` を書くと、値が**平文で state に入る**
# > （`gs://faredgelabs-tfstate`）。入れ物だけ管理して、中身はこうする:
# >
# >     gcloud secrets versions add openai-api-key --data-file=- --project=faredgelabs
# >
# > `version = "latest"` なので、**鍵の差し替えにデプロイは要らない**。次の起動から拾う。
# >
# > CI から `gcloud secrets versions add` を回す案は検討して見送った（2026-09-11）。
# > `tf-deployer` は既に `secretmanager.admin` を持っているので権限的には可能だが、
# > **手作業が消えるのではなく GitHub Secrets へ移るだけ**で、値の複製が2箇所になり、
# > push のたびに版が増える対策も要る。年に数回しか変わらない値には見合わない。
# > 加えて、いま Secret Manager への書き込みは人間しかやらないので、**監査ログに
# > `versions add` が出たらそれ自体が異常**という信号が残っている。自動化すると消える。
# >
# > 再検討する条件: 触る人が増える / 環境を作り直す機会が出る / 鍵の更新が定常になる。

# --------------------------------------------------------------------------- #
# 実行時の identity
# --------------------------------------------------------------------------- #

resource "google_service_account" "realtime_call" {
  account_id   = "realtime-call"
  display_name = "realtime call relay runtime"

  # シークレットを2つ読む。それだけ。バケットにもデータベースにも触らない。
  description = "Reads the OpenAI key and the shared Turnstile secret. Nothing else."
}

resource "google_secret_manager_secret_iam_member" "realtime" {
  for_each = google_secret_manager_secret.realtime

  secret_id = each.value.id
  role      = "roles/secretmanager.secretAccessor"
  member    = google_service_account.realtime_call.member
}

# Turnstile は `contact.tf` の入れ物を共有する。**読み手が増えるだけで、値は1つ。**
resource "google_secret_manager_secret_iam_member" "realtime_turnstile" {
  secret_id = google_secret_manager_secret.contact["TURNSTILE_SECRET"].id
  role      = "roles/secretmanager.secretAccessor"
  member    = google_service_account.realtime_call.member
}

# --------------------------------------------------------------------------- #
# ソース
# --------------------------------------------------------------------------- #

data "archive_file" "realtime_call" {
  type        = "zip"
  output_path = "${path.module}/.build/realtime-call.zip"

  # `main.tf` / `contact.tf` と同じで、**ディレクトリではなくファイルを列挙する**。
  #
  # > [!warning] 書き忘れると apply もデプロイも通って、最初の通話で落ちる
  # > この関数だけソースが4つある。`main.py` が `from instruction import ...` し、
  # > その `instruction.py` が `company.md` を読む。どちらを落としても
  # > **apply は通り、デプロイも成功し、通話だけが落ちる**。増やしたらここも増やすこと。
  source {
    content  = file("${local.realtime_call_src}/main.py")
    filename = "main.py"
  }

  source {
    content  = file("${local.realtime_call_src}/instruction.py")
    filename = "instruction.py"
  }

  source {
    content  = file("${local.realtime_call_src}/requirements.txt")
    filename = "requirements.txt"
  }

  # man が喋る中身。**コードではなく原稿**なので markdown のまま同梱する。
  source {
    content  = file("${local.realtime_call_src}/company.md")
    filename = "company.md"
  }
}

# 名前にハッシュを入れる理由は `main.tf` と同じ。固定名だとコードを書き換えても
# Terraform に差分が出ず、`apply` が「変更なし」と言いながら古い版が動き続ける。
resource "google_storage_bucket_object" "realtime_call" {
  name   = "realtime-call-${data.archive_file.realtime_call.output_sha}.zip"
  bucket = google_storage_bucket.function_source.name
  source = data.archive_file.realtime_call.output_path
}

# --------------------------------------------------------------------------- #
# 関数
# --------------------------------------------------------------------------- #

resource "google_cloudfunctions2_function" "realtime_call" {
  name     = "realtime-call"
  location = var.region

  description = "Public endpoint that relays a WebRTC SDP offer to OpenAI. Turnstile gated."

  build_config {
    runtime     = "python312"
    entry_point = "start_realtime_call"

    service_account = google_service_account.function_build.id

    source {
      storage_source {
        bucket = google_storage_bucket.function_source.name
        object = google_storage_bucket_object.realtime_call.name
      }
    }
  }

  service_config {
    service_account_email = google_service_account.realtime_call.email

    # 上流への POST に `main.py` 側で 30 秒の上限を置いている。それより短くすると
    # こちらが先に切って、上流が何を返したのか分からなくなる。
    timeout_seconds  = 60
    available_memory = "256Mi"

    # `contact_form` と同じ理由。**「話しかける」を押してから鳴るまでの待ち時間**が
    # ほぼコールドスタートなので、起動に CPU が効く。依存が `functions-framework`
    # だけなので import は軽いが、Python の起動と TLS のハンドシェイクは残る。
    #
    # 費用は増えない。リクエストを処理している時間だけ課金される。
    available_cpu = "1"

    # > [!warning] これは費用の上限では**ない**。`contact_form` と意味が違う
    # > あちらは1リクエストが SMTP を最長 20 秒握るので、3インスタンスが実質の
    # > スループット上限になり、そのまま請求の蓋として働く。
    # >
    # > ここは中継1本で終わるので、3インスタンスでも**大量の通話を開始できる**。
    # > しかも費用が出るのはこの関数ではなく OpenAI 側。
    # >
    # > **支出を止めるのは OpenAI の月次上限**（$30 に設定済み）。ここは
    # > 「暴走してもインスタンスが増え続けない」以上の意味を持たない。
    #
    # 本番のレイテンシ実測（2026-09-15、200 応答 n=22）:
    #
    #     最小 0.279s / 中央値 0.943s / 最大 2.058s
    #     0〜0.4s:4本  0.4〜1.0s:7本  1.0〜1.5s:4本  1.5s〜:7本
    #
    # **二山ではない。** 「温まっていれば速い / コールドなら遅い」で説明できる形を
    # していないので、遅さをコールドスタートだけに帰属させないこと（上流の
    # セッション生成時間も動いていると思われる。切り分けてはいない）。
    #
    # 最遅の 2.06s で見ても、同時3・concurrency 1 で **毎分 87 通話開始**。中央値なら
    # 191。このサイトの流入では上限に触れない。
    #
    # > [!warning] この計測は開発者自身の手動アクセス
    # > 連続した負荷ではないので、**並行時の振る舞いは何も言えない**。言えるのは
    # > 1本あたりの所要時間だけ。並行で詰まるかを知りたければ、実際に詰まってから
    # > 測ること。
    #
    # そもそも**上限3で足りる根拠は、この数字ではなく構造のほう。通話中の会話は
    # この関数を通らない** —— SDP を中継したら経路から外れるので、同時会話数と同時
    # リクエスト数は別物。10人が喋っていてもここへの負荷はゼロ。引っかかるのは
    # 「3人が同じ1〜2秒の窓でボタンを押したとき」だけ。
    #
    # なお `max_instance_count` を上げても**訪問者の体感は縮まない**。1本あたりの
    # 所要時間は同時数と無関係で、縮めたければ `min_instance_count` を立てて
    # **常時課金**するしかない。いまの流入では割に合わないので払っていない。
    max_instance_count = 3

    # 1。ただし `contact_form` とは事情が違う。
    #
    # あちらは SMTP のソケットを長く握るので、詰め込むと1インスタンスの中で互いを
    # 待たせる。**ここは短い HTTPS 1本なので、上げても待たせない。** 上げれば温まった
    # インスタンスが連続する通話開始を捌けて、コールドスタートが減る。
    #
    # それでも 1 にしてあるのは、上げても**何も改善しないから**（上の実測）。詰まって
    # いないものを詰まらなくしても、git 履歴に判断の跡が残るだけで中身は変わらない。
    # 上げる代償はゼロ（むしろ1インスタンスに詰めるほうが instance-second は減る）
    # なので、**実際に上限で詰まったら上げればよい**。
    #
    # 上げるときは `available_cpu` が 1 以上であることを確認すること（1 未満だと
    # `Total cpu < 1 is not supported with concurrency > 1` で apply が落ちる）。
    max_instance_request_concurrency = 1

    # モデル ID も音声も指示文も**コードの中**にある（`main.py` の定数と
    # `instruction.py`）。設定に逃がすと、どの値で喋ったのかが git から追えなくなる。
    # 会社の資料も同じで、`gc_run_functions/realtime_call/company.md` にある。
    dynamic "secret_environment_variables" {
      for_each = merge(
        { for key, secret in google_secret_manager_secret.realtime : key => secret.secret_id },
        { TURNSTILE_SECRET = google_secret_manager_secret.contact["TURNSTILE_SECRET"].secret_id },
      )

      content {
        key        = secret_environment_variables.key
        project_id = var.project_id
        secret     = secret_environment_variables.value
        version    = "latest"
      }
    }

    ingress_settings = "ALLOW_ALL"
  }

  depends_on = [
    google_project_service.enabled,
    google_project_iam_member.function_build,
    google_storage_bucket_iam_member.function_build_source,
    google_secret_manager_secret_iam_member.realtime,
    google_secret_manager_secret_iam_member.realtime_turnstile,
  ]
}

# --------------------------------------------------------------------------- #
# 公開
# --------------------------------------------------------------------------- #

# > [!warning] 意図的に無認証。**これで2つ目**
# > `CLAUDE.md` は `contact-form` を "the one unauthenticated endpoint in the project"
# > と書いている。**この資源が入った時点でその記述は嘘になる**ので直すこと。
# >
# > ただし性質は `contact-form` より良い。API キーもモデルも指示文も**サーバ側**に
# > あり、ブラウザは SDP しか送れない。濫用者にできるのは「会話を始めること」だけで、
# > モデルを差し替えたり指示文を書き換えたりする経路が無い。
# >
# > 帰属先は `main.py` の門（メソッド・`Origin`・本文の大きさ・Turnstile）と、
# > **OpenAI 側の月次支出上限**。後者が本当の蓋なので、緩めるならそちらを見ること。
resource "google_cloud_run_service_iam_member" "realtime_call_public" {
  location = google_cloudfunctions2_function.realtime_call.location
  service  = google_cloudfunctions2_function.realtime_call.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
