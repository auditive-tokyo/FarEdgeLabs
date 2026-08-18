# お問い合わせフォームの一式。`main.tf` から分けてあるのは、6つ目のファイルを作る
# ためではなく、**これが2つ目の成果物**だから — `wif.tf` を分けているのと同じ理由。
# 稼働統計の関数を読むときにこちらを読む必要はなく、逆も同じ。
#
# `main.tf` と共有しているもの: 有効化した API、ソース置き場のバケット、ビルド用の
# サービスアカウント。共有していないもの: 実行時の identity、シークレット、そして
# **公開範囲**。
#
# > [!warning] この関数は世界中から呼べる
# > `work_statistics` は Scheduler だけが叩ける私物だが、こちらはブラウザが直接叩く
# > ので `allUsers` に `run.invoker` を渡す（下の方）。前段に認証が無い唯一の
# > エンドポイントなので、防御は `main.py` の4層と、ここの `max_instance_count` に
# > しかない。

# --------------------------------------------------------------------------- #
# レートリミットは無い
#
# 一度は Firestore に TTL 付きの打刻を持つ層を書いて、消した。判断の記録は
# `../gc_run_functions/contact_form/main.py` の冒頭にある。要点だけ:
#
#   5分に3回は1日 864 通通るので本気の相手には効かず、IP を分散されれば per-IP は
#   素通り。残る効果は Turnstile が担当する範囲とほぼ重なる。対して払っていたのが
#   **プロジェクト全体の `roles/datastore.user`**（Firestore にはコレクション単位の
#   IAM が無い）と、Firestore が不調ならフォームが止まる fail closed。
#
# **マネージドな代替も買っていない。** GCP で L7 の IP 単位レートリミットを買えるのは
# Cloud Armor だけで、前段にグローバル LB（serverless NEG）が必須、転送ルールの時間
# 課金がトラフィックゼロでも発生する。フォーム1つには不釣り合い。
#
# L3/L4 の物量攻撃は Google Front End が無料で吸うので、そこは元から何もしない。
# 残る防御は Turnstile と入力上限、そして下の `max_instance_count`。
# --------------------------------------------------------------------------- #

# --------------------------------------------------------------------------- #
# シークレット
#
# コンテナだけ。**値は Terraform を通さない**（理由は `main.tf` のシークレットの節）。
#
#   printf '%s' 'zoho のアプリパスワード' | gcloud secrets versions add contact-app-password   --data-file=-
#   printf '%s' 'turnstile の secret key' | gcloud secrets versions add turnstile-secret       --data-file=-
#   printf '%s' 'noreply@…'               | gcloud secrets versions add contact-sender-email   --data-file=-
#   printf '%s' '受信するアドレス'         | gcloud secrets versions add contact-receiver-email --data-file=-
#
# 後ろ2つは**秘密ではない**。ここに入れているのは
# **このリポジトリが public だから**で、`variables.tf` の default に書くとアドレスが
# 収集される。それはお問い合わせフォームを置く意味を消す。秘匿ではなく、公開の
# リポジトリに個人情報を置かないための入れ物。
#
# 有効バージョン1つあたり月 $0.06 なので、4つで月 ¥40 程度。
# --------------------------------------------------------------------------- #

locals {
  # 環境変数名 => Secret Manager の名前。関数側の `secret_environment_variables` は
  # このマップから生成するので、増やすときに触るのはここ1か所。
  contact_secrets = {
    APP_PASSWORD     = "contact-app-password"
    TURNSTILE_SECRET = "turnstile-secret"
    SENDER_EMAIL     = "contact-sender-email"
    RECEIVER_EMAIL   = "contact-receiver-email"
  }
}

resource "google_secret_manager_secret" "contact" {
  for_each = local.contact_secrets

  secret_id = each.value

  replication {
    auto {}
  }

  depends_on = [google_project_service.enabled]
}

# --------------------------------------------------------------------------- #
# 実行時の identity
#
# 稼働統計の関数とは別のアカウント。やることが違うので権限も違う。
# --------------------------------------------------------------------------- #

resource "google_service_account" "contact_form" {
  account_id   = "contact-form"
  display_name = "contact form function runtime"

  # シークレットを4つ読む。それだけ。バケットにもデータベースにも触らないので、
  # `secretAccessor` 以外の付与はこのファイルに存在しない。
  description = "Reads the four contact secrets. Nothing else."
}

resource "google_secret_manager_secret_iam_member" "contact" {
  for_each = google_secret_manager_secret.contact

  secret_id = each.value.id
  role      = "roles/secretmanager.secretAccessor"
  member    = google_service_account.contact_form.member
}

# --------------------------------------------------------------------------- #
# ソース書庫
#
# `main.tf` と同じで、ディレクトリではなく**ファイルを列挙する**。除外リストは、
# 隠すべきファイルが増えた日に伸ばし忘れて漏れる。許可リストは漏らせない。
# --------------------------------------------------------------------------- #

locals {
  contact_form_src = "${path.module}/../gc_run_functions/contact_form"
}

data "archive_file" "contact_form" {
  type        = "zip"
  output_path = "${path.module}/.build/contact-form.zip"

  source {
    content  = file("${local.contact_form_src}/main.py")
    filename = "main.py"
  }

  source {
    content  = file("${local.contact_form_src}/requirements.txt")
    filename = "requirements.txt"
  }
}

# 名前にハッシュを入れる理由は `main.tf` と同じ。固定名だと `main.py` を書き換えても
# Terraform に差分が出ず、`apply` が「変更なし」と言いながら古いコードが動き続ける。
resource "google_storage_bucket_object" "contact_form" {
  name   = "contact-form-${data.archive_file.contact_form.output_sha}.zip"
  bucket = google_storage_bucket.function_source.name
  source = data.archive_file.contact_form.output_path
}

# --------------------------------------------------------------------------- #
# 関数
# --------------------------------------------------------------------------- #

resource "google_cloudfunctions2_function" "contact_form" {
  name     = "contact-form"
  location = var.region

  description = "Public endpoint for the site's contact form. Turnstile + rate limited."

  build_config {
    runtime     = "python312"
    entry_point = "submit_contact_form"

    service_account = google_service_account.function_build.id

    source {
      storage_source {
        bucket = google_storage_bucket.function_source.name
        object = google_storage_bucket_object.contact_form.name
      }
    }
  }

  service_config {
    service_account_email = google_service_account.contact_form.email

    # 内訳は Turnstile 10s + Firestore 1往復 + SMTP 20s。60 で足りる。長くしても
    # 詰まる時間が伸びるだけで、送れるようにはならない。
    timeout_seconds  = 60
    available_memory = "256Mi"

    # > [!important] これが費用の上限で、実質いちばんの DDoS 対策
    # 攻撃は止まらないが、**「請求が無限に伸びる」を「リクエストが 429/503 で
    # 落ちる」に変換する**。小さいサイトで物量攻撃が本当に怖いのは金額なので、
    # 無料で効く制御はこれ。上げるときは上限額を上げていると理解して上げる。
    max_instance_count = 3

    # 1 ではなく 4。`main.py` は並行に捌けるように書いてある（リクエストに紐づく値を
    # モジュール変数に置かない）ので、ここは**正しさの境界ではなく絞り**。控えめなのは
    # 1リクエストが SMTP のソケットを最長 20 秒握るから。同時に飛ぶのは最大
    # 3 × 4 = 12 件。
    max_instance_request_concurrency = 4

    # `environment_variables` は無い。秘密でない設定が1つも残っていないので、空の
    # ブロックを置かずに省いてある。レートリミットを落としたときに
    # `RATE_LIMIT_COLLECTION` と `FORWARDED_TRUST_DEPTH` が両方消えた。

    dynamic "secret_environment_variables" {
      for_each = local.contact_secrets

      content {
        key        = secret_environment_variables.key
        project_id = var.project_id
        secret     = google_secret_manager_secret.contact[secret_environment_variables.key].secret_id
        version    = "latest"
      }
    }

    ingress_settings = "ALLOW_ALL"
  }

  depends_on = [
    google_project_service.enabled,
    google_project_iam_member.function_build,
    google_storage_bucket_iam_member.function_build_source,
    google_secret_manager_secret_iam_member.contact,
  ]
}

# --------------------------------------------------------------------------- #
# 公開
# --------------------------------------------------------------------------- #

# > [!warning] 意図的に無認証。このリポジトリで唯一
# > ブラウザが送信ボタンで叩くので、呼び手を IAM で絞れない。**消したらフォームが
# > 動かなくなるが、これが無いことが正常な資源は他に無い** — `work_statistics` の
# > `run.invoker` は Scheduler のアカウント1つに閉じている。
# >
# > 無認証であることの帰属先は `main.py` の4層と、上の `max_instance_count`。
# > どちらかを緩めるときは、この行を思い出してから緩める。
resource "google_cloud_run_service_iam_member" "contact_form_public" {
  location = google_cloudfunctions2_function.contact_form.location
  service  = google_cloudfunctions2_function.contact_form.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
