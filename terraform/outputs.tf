# The two values the workflow needs. Neither is a secret: they identify, they do not
# authorise. Put them in the workflow file, or in GitHub *variables* — a repository
# secret would only obscure them, and `attribute_condition` is what actually keeps
# strangers out.
output "workload_identity_provider" {
  description = "Pass to google-github-actions/auth as workload_identity_provider."
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "deployer_service_account" {
  description = "Pass to google-github-actions/auth as service_account."
  value       = google_service_account.deployer.email
}

output "stats_url" {
  description = "What the site fetches. `storage.cloud.google.com` would demand auth."
  value       = "https://storage.googleapis.com/${google_storage_bucket.public.name}/stats.json"
}

output "function_uri" {
  description = "Private — only the scheduler's service account may call it."
  value       = google_cloudfunctions2_function.work_statistics.service_config[0].uri
}
