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
  # > [!warning] `instruction.py` を落とすと ModuleNotFoundError で死ぬ
  # > この関数だけソースが3つある。`main.py` が `from instruction import ...` して
  # > いるので、ここに書き忘れると **apply は通り、デプロイも成功し、最初の通話で
  # > 落ちる**。ファイルを増やしたらここも増やすこと。
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
    # > ここは中継が数百ミリ秒で終わるので、3インスタンスでも**大量の通話を開始
    # > できる**。しかも費用が出るのはこの関数ではなく OpenAI 側。
    # >
    # > **支出を止めるのは OpenAI の月次上限**（ダッシュボードで設定）。ここは
    # > 「暴走してもインスタンスが増え続けない」以上の意味を持たない。
    max_instance_count = 3

    # 1。ただし `contact_form` とは事情が違う。
    #
    # あちらは SMTP のソケットを長く握るので、詰め込むと1インスタンスの中で互いを
    # 待たせる。**ここは短い HTTPS 1本なので、上げても待たせない。** 上げれば温まった
    # インスタンスが連続する通話開始を捌けて、コールドスタートが減る。
    #
    # それでも 1 にしてあるのは、まだ実際の同時数が分かっていないから。上げるときは
    # `available_cpu` が 1 以上であることを確認すること（1 未満だと
    # `Total cpu < 1 is not supported with concurrency > 1` で apply が落ちる）。
    max_instance_request_concurrency = 1

    # `environment_variables` は無い。モデル ID も音声も指示文も**コードの中**にある
    # （`main.py` の定数と `instruction.py`）。設定に逃がすと、どの値で喋ったのかが
    # git から追えなくなる。
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
