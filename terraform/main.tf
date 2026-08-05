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
    "cloudscheduler.googleapis.com",
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

resource "google_storage_bucket" "public" {
  name     = "${var.project_id}-public"
  location = upper(var.region)

  uniform_bucket_level_access = true

  # Deliberately not "enforced": the whole point of this bucket is that a browser can
  # read one object from it without credentials. The grant below is what makes that
  # true, and it is scoped to readers only.
  public_access_prevention = "inherited"

  # Read by `fetch` from the site, so the browser needs the bucket to say the origin
  # is allowed. GCS answers CORS preflights itself; there is no gateway in front of it.
  cors {
    origin          = var.site_origins
    method          = ["GET", "HEAD"]
    response_header = ["Content-Type"]
    max_age_seconds = 3600
  }

  depends_on = [google_project_service.enabled]
}

resource "google_storage_bucket_iam_member" "public_read" {
  bucket = google_storage_bucket.public.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

# --------------------------------------------------------------------------- #
# Secrets
#
# The containers only. **The values are added out of band:**
#
#   printf '%s' 'API KEY ID'  | gcloud secrets versions add jibble-api-key    --data-file=-
#   printf '%s' 'API SECRET'  | gcloud secrets versions add jibble-api-secret --data-file=-
#
# `printf` rather than `echo` so no trailing newline is stored — a secret with an
# invisible `\n` authenticates nowhere and looks perfectly present. Verify by
# comparing byte lengths, never by printing the value.
#
# Terraform could manage the versions too, and is kept out on purpose: a value passed
# through Terraform is written to state in the clear, and reaches state by way of a
# variable that can be committed by accident. Keeping the payload out means the only
# copies are Secret Manager and wherever Jibble showed it once.
#
# Consequence when rebuilding from nothing: the first apply fails on the function,
# because it asks for version `latest` of a secret that has none yet. Create the
# containers, add the versions, apply again.
# --------------------------------------------------------------------------- #

resource "google_secret_manager_secret" "jibble_api_key" {
  secret_id = "jibble-api-key"

  replication {
    auto {}
  }

  depends_on = [google_project_service.enabled]
}

resource "google_secret_manager_secret" "jibble_api_secret" {
  secret_id = "jibble-api-secret"

  replication {
    auto {}
  }

  depends_on = [google_project_service.enabled]
}

# --------------------------------------------------------------------------- #
# Source archive
#
# Built from an **explicit list of files, not the directory**. An `excludes` list
# would work until the day someone adds a file worth hiding and forgets to extend it —
# and the source directory contains `.env` with the Jibble credentials, plus a
# `.venv`. An allow-list cannot upload a secret by omission.
#
# `probe.py` and `requirements-dev.txt` are left out for the same reason they exist:
# they are laptop tools. The function needs `main.py` and its runtime dependencies.
# --------------------------------------------------------------------------- #

locals {
  function_src = "${path.module}/../gc_run_functions/work_statics"
}

data "archive_file" "work_statistics" {
  type        = "zip"
  output_path = "${path.module}/.build/work-statistics.zip"

  source {
    content  = file("${local.function_src}/main.py")
    filename = "main.py"
  }

  source {
    content  = file("${local.function_src}/requirements.txt")
    filename = "requirements.txt"
  }
}

# The hash belongs in the object name. With a fixed name, editing `main.py` produces
# no Terraform diff — the bucket object is "the same object" — and `apply` reports
# nothing to do while the old code keeps running. A content-addressed name makes a
# code change a new object and therefore a new function revision. It is a
# cache-busting identifier, not a security property.
resource "google_storage_bucket_object" "work_statistics" {
  name   = "work-statistics-${data.archive_file.work_statistics.output_sha}.zip"
  bucket = google_storage_bucket.function_source.name
  source = data.archive_file.work_statistics.output_path
}

# --------------------------------------------------------------------------- #
# Runtime identity
#
# Its own account, not the project default. The default compute service account
# carries Editor on the whole project; this one may read two secrets and write to one
# bucket, which is the entire list of things the function does.
# --------------------------------------------------------------------------- #

resource "google_service_account" "work_statistics" {
  account_id   = "work-statistics"
  display_name = "work statistics function runtime"
}

resource "google_secret_manager_secret_iam_member" "api_key" {
  secret_id = google_secret_manager_secret.jibble_api_key.id
  role      = "roles/secretmanager.secretAccessor"
  member    = google_service_account.work_statistics.member
}

resource "google_secret_manager_secret_iam_member" "api_secret" {
  secret_id = google_secret_manager_secret.jibble_api_secret.id
  role      = "roles/secretmanager.secretAccessor"
  member    = google_service_account.work_statistics.member
}

# Scoped to the one bucket, not the project. A project-level `storage.objectAdmin`
# would also let this function rewrite its own source archive.
resource "google_storage_bucket_iam_member" "work_statistics_writer" {
  bucket = google_storage_bucket.public.name
  role   = "roles/storage.objectAdmin"
  member = google_service_account.work_statistics.member
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
  account_id   = "work-statistics-build"
  display_name = "work statistics function builder"
  description  = "Used by Cloud Build to build the function. Builds nothing else."
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

# --------------------------------------------------------------------------- #
# The function
# --------------------------------------------------------------------------- #

resource "google_cloudfunctions2_function" "work_statistics" {
  name     = "work-statistics"
  location = var.region

  description = "Daily Jibble aggregate written to gs://<public>/stats.json"

  build_config {
    # `python313` may well be available; 312 is chosen because it certainly is, and
    # `main.py` needs nothing newer (it carries `from __future__ import annotations`).
    runtime = "python312"

    # The name is free — Cloud Run functions take it as `--entry-point`. Only the
    # *file* has to be `main.py`.
    entry_point = "refresh_work_statistics"

    service_account = google_service_account.function_build.id

    source {
      storage_source {
        bucket = google_storage_bucket.function_source.name
        object = google_storage_bucket_object.work_statistics.name
      }
    }
  }

  service_config {
    service_account_email = google_service_account.work_statistics.email

    # Two or three calls to Jibble and one small object written. The default 60s is
    # generous already; 120 covers a slow day at Jibble without letting a hung
    # request bill for minutes.
    timeout_seconds    = 120
    available_memory   = "256Mi"
    max_instance_count = 2

    # Left at the default of 1. Nothing here is written to be concurrency-safe, and
    # one invocation a day has no reason to share an instance.
    max_instance_request_concurrency = 1

    environment_variables = {
      STATS_BUCKET    = google_storage_bucket.public.name
      STATS_OBJECT    = "stats.json"
      WINDOW_TIMEZONE = "Asia/Tokyo"
    }

    secret_environment_variables {
      key        = "JIBBLE_API_KEY"
      project_id = var.project_id
      secret     = google_secret_manager_secret.jibble_api_key.secret_id
      version    = "latest"
    }

    secret_environment_variables {
      key        = "JIBBLE_API_SECRET"
      project_id = var.project_id
      secret     = google_secret_manager_secret.jibble_api_secret.secret_id
      version    = "latest"
    }

    # > [!important] There is no `allow_unauthenticated` here, and that is the point.
    # A gen2 function is a Cloud Run service, and invocation is gated by
    # `roles/run.invoker` on that service. Only the scheduler's account is granted it,
    # below. Nothing else can call this URL — including a stranger who finds it, which
    # they will.
    ingress_settings = "ALLOW_ALL"
  }

  depends_on = [
    google_project_service.enabled,
    google_project_iam_member.function_build,
    google_storage_bucket_iam_member.function_build_source,
    google_secret_manager_secret_iam_member.api_key,
    google_secret_manager_secret_iam_member.api_secret,
  ]
}

# --------------------------------------------------------------------------- #
# Schedule
#
# Cloud Scheduler is the only caller of the function.
#
# A Cloud Run *job* would have needed no URL at all, which was the one argument for
# using one. It lost to keeping a single deployment shape for the whole backend; the
# cost of that choice is exactly the IAM below, and it is two resources.
# --------------------------------------------------------------------------- #

resource "google_service_account" "scheduler" {
  account_id   = "scheduler-invoker"
  display_name = "Cloud Scheduler invoker"
  description  = "The only identity permitted to invoke the work statistics function."
}

# The grant that makes the function private. It is on the underlying Cloud Run
# service, because that is where a 2nd-gen function's invocation check happens —
# granting `cloudfunctions.invoker` instead is the common way to end up with a
# function that still answers 403.
resource "google_cloud_run_service_iam_member" "scheduler_invoker" {
  location = google_cloudfunctions2_function.work_statistics.location
  service  = google_cloudfunctions2_function.work_statistics.name
  role     = "roles/run.invoker"
  member   = google_service_account.scheduler.member
}

resource "google_cloud_scheduler_job" "work_statistics_daily" {
  name        = "work-statistics-daily"
  region      = var.region
  description = "Refresh the hero panel's figures once a day."

  # 06:00 Asia/Tokyo. The window this produces ends *yesterday*, so the run needs only
  # to happen after midnight local time; early morning keeps it clear of the working
  # day, when a failure would be noticed and could be re-run by hand.
  schedule  = "0 6 * * *"
  time_zone = "Asia/Tokyo"

  # Scheduler retries a non-2xx by itself, which is why the function returns one on
  # failure instead of swallowing it.
  retry_config {
    retry_count = 3
  }

  http_target {
    http_method = "POST"
    uri         = google_cloudfunctions2_function.work_statistics.service_config[0].uri

    # The audience is the function's URL. Scheduler signs a token for it, Cloud Run
    # verifies it, and the `run.invoker` grant above decides whether the caller is
    # allowed. No shared secret anywhere in this path.
    oidc_token {
      service_account_email = google_service_account.scheduler.email
      audience              = google_cloudfunctions2_function.work_statistics.service_config[0].uri
    }
  }

  depends_on = [
    google_project_service.enabled,
    google_cloud_run_service_iam_member.scheduler_invoker,
  ]
}
