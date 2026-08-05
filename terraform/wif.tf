# Keyless authentication for GitHub Actions — the GCP counterpart of an AWS OIDC
# provider plus an assumable IAM role.
#
#   AWS OIDC identity provider   -> workload identity pool + provider
#   IAM role + trust policy      -> service account + workloadIdentityUser binding
#   role ARN                     -> the provider's resource name (see outputs.tf)
#
# Neither the provider resource name nor the service account email is a secret.
# They grant nothing on their own, exactly like a role ARN. **All of the security is
# in `attribute_condition` below and in the binding underneath it.**

resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = "github"
  display_name              = "GitHub Actions"
  description               = "Federated identities for GitHub Actions workflows."

  depends_on = [google_project_service.enabled]
}

resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-actions"
  display_name                       = "GitHub Actions OIDC"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }

  # Mapped so the claims can be named in a principalSet. `google.subject` is
  # required; the rest exist to be addressable.
  attribute_mapping = {
    "google.subject"                = "assertion.sub"
    "attribute.repository"          = "assertion.repository"
    "attribute.repository_id"       = "assertion.repository_id"
    "attribute.repository_owner_id" = "assertion.repository_owner_id"
    "attribute.ref"                 = "assertion.ref"
  }

  # > [!important] Without this, every public repository on GitHub can mint a token
  # > for this project.
  # The pool trusts GitHub's issuer, and GitHub issues tokens to *all* of its
  # workflows. Omitting the condition is the documented spoofing trap and is the
  # direct equivalent of an AWS trust policy matching `repo:*`. Hiding the provider
  # name in a repository secret does nothing about it; this line is the control.
  attribute_condition = <<-CEL
    assertion.repository_owner_id == "${var.github_owner_id}" &&
    assertion.repository_id == "${var.github_repository_id}"
  CEL
}

# --------------------------------------------------------------------------- #
# The identity CI acts as
# --------------------------------------------------------------------------- #

resource "google_service_account" "deployer" {
  account_id   = "tf-deployer"
  display_name = "Terraform deployer (GitHub Actions)"
  description  = "Impersonated through Workload Identity Federation. No keys."
}

# Scoped to this repository, any ref. The workflow is what separates plan from
# apply: plan runs on branches, apply only on `production` or a manual dispatch.
#
# Tightening further means a second service account whose binding pins
# `attribute.ref`, with plan holding read-only roles. Worth doing the day someone
# else can push here; today the trigger rules carry it.
resource "google_service_account_iam_member" "deployer_wif" {
  service_account_id = google_service_account.deployer.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_repository}"
}

# Terraform manages IAM bindings here, which means this account can grant roles —
# it is effectively a project administrator. That is inherent to letting CI own the
# infrastructure, and it is why `attribute_condition` and the workflow triggers are
# the things to get right rather than these role names.
locals {
  deployer_roles = [
    "roles/storage.admin",
    "roles/secretmanager.admin",
    "roles/cloudfunctions.admin",
    "roles/run.admin",
    "roles/cloudscheduler.admin",
    "roles/iam.serviceAccountAdmin",
    "roles/iam.serviceAccountUser",
    "roles/iam.workloadIdentityPoolAdmin",
    "roles/resourcemanager.projectIamAdmin",
    "roles/serviceusage.serviceUsageAdmin",
    "roles/cloudbuild.builds.editor",
    "roles/artifactregistry.admin",
  ]
}

resource "google_project_iam_member" "deployer" {
  for_each = toset(local.deployer_roles)

  project = var.project_id
  role    = each.value
  member  = google_service_account.deployer.member
}
