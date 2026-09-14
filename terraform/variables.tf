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

variable "site_origins" {
  description = <<-EOT
    Origins a browser may read stats.json from.

    `localhost` is in the list on purpose. CORS is **not** a security control for an
    object that is already world-readable — anyone can `curl` it, and the grant to
    `allUsers` is what decides who may. All CORS decides is which pages a *browser* will
    hand the response to. Leaving the dev origin out would mean the panel could only be
    seen working after a deploy, which is how a broken fetch reaches production
    unnoticed.
  EOT
  type        = list(string)
  default     = ["https://faredgelabs.com", "http://localhost:3000"]
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

variable "openai_vector_store_id" {
  description = "man が file_search で引く資料の置き場。秘密ではない（API キーが無ければ使えない識別子）"
  type        = string

  # **手で作って、ここに書く。** Terraform に OpenAI の provider は無いので、
  # `gcloud secrets versions add` と同じ「器は IaC、中身は手」の形になる。
  # 資料の原本は `private/vector-store/`（git 管理外）。
  default = "vs_REPLACE_ME"

  # 置き換え忘れで apply が通ってしまうと、**関数はデプロイされて通話だけ落ちる**。
  # 症状が上流の 400 としてしか出ないので、plan の時点で止める。
  validation {
    condition     = var.openai_vector_store_id != "vs_REPLACE_ME"
    error_message = "openai_vector_store_id が未設定。ベクトルストアを作成して ID を variables.tf に書くこと。"
  }
}
