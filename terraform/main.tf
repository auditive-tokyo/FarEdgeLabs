# Everything this project builds, except the CI trust relationship — that lives in
# `wif.tf`, kept separate because it is the security boundary and changes for entirely
# different reasons than the function does.
#
# Terraform concatenates every `.tf` file in the directory before evaluating any of
# it, and resolves order from references rather than position. So the grouping here is
# for readers only; the sections run top to bottom in roughly the order the resources
# come into existence.

# --------------------------------------------------------------------------- #
# APIs
#
# Enabled as code rather than by clicking, so the project can be rebuilt.
#
# `disable_on_destroy = false`: destroying this configuration should remove what it
# built, not switch off APIs that other things in the project might rely on. Disabling
# an API is also far slower and more disruptive to undo than deleting a bucket.
# --------------------------------------------------------------------------- #

locals {
  services = [
    "cloudresourcemanager.googleapis.com",
    "serviceusage.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "sts.googleapis.com",
    "storage.googleapis.com",
    "secretmanager.googleapis.com",
    "cloudfunctions.googleapis.com",
    "run.googleapis.com",
    "cloudbuild.googleapis.com",
    "artifactregistry.googleapis.com",
    "logging.googleapis.com",
  ]
}

resource "google_project_service" "enabled" {
  for_each = toset(local.services)

  service            = each.value
  disable_on_destroy = false
}

# --------------------------------------------------------------------------- #
# Buckets
#
# Three, and the first two must stay separate. One holds the function's source
# archive and is sealed shut; one holds a single public JSON file. Putting the source
# in the public bucket would publish the service's code — that is the mistake this
# separation exists to make impossible.
# --------------------------------------------------------------------------- #

# The bucket that holds this configuration's own state. See the backend block in
# `versions.tf` for the two-step bootstrap.
resource "google_storage_bucket" "tfstate" {
  name     = "${var.project_id}-tfstate"
  location = upper(var.region)

  # State is the record of what exists. Versioning is what turns "I applied
  # something wrong" into a recoverable mistake rather than a lost inventory.
  versioning {
    enabled = true
  }

  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  # Terraform state contains every value it manages, including secret payloads if any
  # are ever passed through it. It must never be publicly readable, and it must not be
  # deletable by the configuration it describes: `terraform destroy` would otherwise
  # remove the bucket holding the state mid-run.
  lifecycle {
    prevent_destroy = true
  }

  depends_on = [google_project_service.enabled]
}

resource "google_storage_bucket" "function_source" {
  name     = "${var.project_id}-fn-source"
  location = upper(var.region)

  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  # Each apply uploads an object named after the archive's hash, so old versions
  # accumulate. They are a few kB each and useful for a rollback, but not forever.
  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type = "Delete"
    }
  }

  depends_on = [google_project_service.enabled]
}

# --------------------------------------------------------------------------- #
# 関数イメージの置き場
#
# **Terraform が作ったものではない。** Cloud Functions が最初のデプロイで自分で作った
# リポジトリを、cleanup policy を張るために import して引き取っている。
#
# なぜイメージが要るのか: Cloud Run functions は「関数」という別サービスではなく
# Cloud Run サービスの薄い包装で、Cloud Run は常にコンテナを動かす。`main.py` を渡すと
# Cloud Build がコンテナイメージに焼いてここに置き、Cloud Run がそれを起動する。
# **Lambda の zip に相当する軽い経路が存在しない**ので、ECR 相当が必ず経路に入る。
#
# 課金されるのはこのストレージだけ。Cloud Run のリビジョン自体は無料で（待機
# インスタンスが 0 なので）、実行されなければ計算資源は発生しない。無料枠 0.5 GB に対し
# デプロイ1回あたり十数 MB 積まれる。
#
# **import は済んでいる**（`id` は
# `projects/faredgelabs/locations/asia-northeast1/repositories/gcf-artifacts`）ので、
# `import` ブロックは消した。次に何かを引き取るときのために: **済んだブロックを残しても
# エラーにはならない。** state に入った対象への `import` は黙って無視され、`plan` は
# exit 0 で `No changes` を返す（1.15.8 で確認）。消すのは掃除であって、急ぐ話ではない。
# --------------------------------------------------------------------------- #

resource "google_artifact_registry_repository" "gcf_artifacts" {
  location      = var.region
  repository_id = "gcf-artifacts"
  format        = "DOCKER"
  mode          = "STANDARD_REPOSITORY"

  # Cloud Functions が付けた値をそのまま宣言する。違う値を書くと apply のたびに
  # Google と取り合いになる。
  description = "This repository is created and used by Cloud Functions for storing function docker images."
  labels = {
    "goog-managed-by" = "cloudfunctions"
  }

  # タグの無いイメージだけ消す。**タグ付きには触らない。**
  #
  # 安全なのは、この構成ではタグの無いイメージが誰からも参照されていないから。
  # Cloud Functions はデプロイごとに新しいイメージへ `version_N` と `latest` を打ち、
  # 古いものも `version_N` を保持する。つまりリビジョンが指しているイメージは必ず
  # タグを持つ。タグが無いのは**ビルドは成功したが関数の作成が失敗した**残骸で、
  # 実際に1つある（`available_cpu` を書き忘れて落ちた apply のもの）。
  #
  # > [!warning] Cloud Run はイメージをダイジェストで固定する
  # > タグではない。だから「タグが無い = 参照されていない」が成り立つのは上の前提の
  # > 下だけで、手で `docker push` するような運用を混ぜたら成り立たなくなる。現在の
  # > リビジョンのイメージを消せばコールドスタートが失敗する。
  #
  # 30日空けているのは、デプロイの最中に一瞬タグが無い状態があっても巻き込まないため。
  cleanup_policies {
    id     = "delete-untagged"
    action = "DELETE"

    condition {
      tag_state  = "UNTAGGED"
      older_than = "2592000s" # 30 日
    }
  }

  # > [!note] タグ付きイメージを消す方針は**まだ入れていない**。入れ方は決まっている
  # > 形は `DELETE` に `older_than` を付けて、`KEEP` の
  # > `most_recent_versions { keep_count = N }` で直近を守る。両方に当たったものは
  # > **keep が勝つ**のが Artifact Registry の規則。
  # >
  # > 保留の理由は `keep_count` の数え方。API リファレンスは「保持する最小数」としか
  # > 書いておらず、リポジトリ全体か**パッケージ単位**かが明記されていない
  # > （併記されている `package_name_prefixes` からはパッケージ単位に読める）。ここを
  # > 取り違えると稼働中のイメージを消しうる — 関数2つとそれぞれの `/cache` で
  # > 4パッケージある。
  # >
  # > **`cleanup_policy_dry_run` で試すことはできるが、それはリポジトリ全体に効く。**
  # > 上のタグ無し削除も一緒に止まるので、「片方だけ本番、片方だけ試験」はできない。
  # > だから入れるときは、一度リポジトリごと dry run にして削除予定をログで確かめ、
  # > それから両方を有効に戻す、という順番になる。
  # >
  # > 急がない。23 MB は無料枠 0.5 GB の 5% で、デプロイ30〜40回ぶんの余裕がある。
  # > 増え方は予算アラートが教えてくれるので、**鳴ったら「攻撃」ではなくこれを疑う**
  # > 余地があることだけ覚えておく。
  lifecycle {
    # 引き取ったが、Google のものでもある。設定から消しただけで `destroy` が走ると、
    # 稼働中の関数が起動できなくなる。
    prevent_destroy = true
  }
}

# --------------------------------------------------------------------------- #
# Build identity
#
# A gen2 function is built by Cloud Build, and that build needs an identity of its
# own. Google changed the default: builds no longer inherit the permissions they used
# to, so a fresh project fails with "missing permission on the build service account"
# — which is exactly what the first apply here did.
#
# The documented fixes are a custom build account or granting
# `roles/cloudbuild.builds.builder` to the **default compute service account**. The
# latter is rejected: that account carries Editor on the whole project, so widening it
# further to fix a build is the wrong direction.
#
# So: a dedicated account that exists only to build this function. It takes the
# umbrella `builds.builder` role rather than an enumerated list of permissions —
# narrowed by *identity* rather than by role. The exact set a build needs has changed
# at least once (that is why this comment exists) and this account can do nothing else
# regardless.
# --------------------------------------------------------------------------- #

resource "google_service_account" "function_build" {
  account_id = "work-statistics-build"

  # `account_id` はこのリポジトリの関数が1つだった時代の名前で、いまは
  # `contact.tf` の関数もこれで建てている。改名しないのは `account_id` が
  # サービスアカウントの identity そのもので、**変えると置き換えになる**から
  # （IAM の付け替えが全部道連れになる）。実態は display_name と description が持つ。
  display_name = "Cloud Functions builder"
  description  = "Used by Cloud Build to build this repository's functions. Builds nothing else."
}

resource "google_project_iam_member" "function_build" {
  project = var.project_id
  role    = "roles/cloudbuild.builds.builder"
  member  = google_service_account.function_build.member
}

# Explicit and bucket-scoped, even though `builds.builder` covers it. The failure mode
# it guards against — a build that cannot read its own source — produces an error
# several steps removed from its cause.
resource "google_storage_bucket_iam_member" "function_build_source" {
  bucket = google_storage_bucket.function_source.name
  role   = "roles/storage.objectViewer"
  member = google_service_account.function_build.member
}
