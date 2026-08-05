# Versions, state and provider configuration — the three things that decide *how*
# Terraform runs, kept apart from *what* it builds (`main.tf`, `wif.tf`).

terraform {
  required_version = "~> 1.15"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 7.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.7"
    }
  }

  # State lives in Cloud Storage, in a bucket `main.tf` also creates.
  #
  # That is circular, so it was resolved once, in two steps: apply with local state to
  # create the bucket, then enable this block and `terraform init -migrate-state` to
  # move the state into it. **Both steps are done. Leave this enabled.**
  #
  # It is not an optional nicety. State is the record of what exists, so a run that
  # cannot see it believes nothing exists — GitHub Actions starting from an empty
  # state would try to create every resource again and fail on all of them. Shared
  # state is what lets CI and a laptop apply the same configuration without fighting.
  #
  # The bucket carries `prevent_destroy` in `main.tf`, because `terraform destroy`
  # would otherwise delete the bucket holding the state it is halfway through reading.
  backend "gcs" {
    bucket = "faredgelabs-tfstate"
    prefix = "faredgelabs"
  }
}

# `project` is written here rather than read from the environment on purpose.
#
# `.envrc` pins `CLOUDSDK_CORE_PROJECT` for ad-hoc `gcloud` commands, but an
# environment variable cannot protect a `terraform apply` run from the wrong
# directory, or from a shell where direnv has not loaded. Declaring it means the
# target is a property of the configuration, identical from a laptop and from CI.
provider "google" {
  project = var.project_id
  region  = var.region
}
