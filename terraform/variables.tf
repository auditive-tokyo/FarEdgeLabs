variable "project_id" {
  description = "Target Google Cloud project."
  type        = string
  default     = "faredgelabs"
}

variable "project_number" {
  description = <<-EOT
    Numeric project id. Needed because a Workload Identity Pool principal is
    addressed by project *number*, never by id.
  EOT
  type        = string
  default     = "89292293815"
}

variable "region" {
  type    = string
  default = "asia-northeast1"
}

variable "site_origin" {
  description = "Origin allowed to read stats.json from the browser."
  type        = string
  default     = "https://faredgelabs.com"
}

# --------------------------------------------------------------------------- #
# GitHub identity
#
# Numeric ids, not names. A repository can be renamed or transferred, and a
# condition written against the name would then match a repository someone else
# controls. The ids are immutable — which also sidesteps GitHub's move to
# immutable `sub` claims for repositories created after 2026-07-15 (this one
# predates it, so it still issues the older format).
# --------------------------------------------------------------------------- #

variable "github_repository" {
  description = "owner/repo, used for the principalSet that may impersonate the deployer."
  type        = string
  default     = "auditive-tokyo/FarEdgeLabs"
}

variable "github_owner_id" {
  type    = string
  default = "122478522"
}

variable "github_repository_id" {
  type    = string
  default = "1287304499"
}
