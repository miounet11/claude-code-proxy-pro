#requires -version 5.1
param(
  [string]$AnthropicKey = "any-value",
  [int]$Port = 8082,
  [switch]$Persist
)

$baseUrl = "http://127.0.0.1:$Port"

# Current session
$env:ANTHROPIC_BASE_URL = $baseUrl
$env:ANTHROPIC_API_KEY = $AnthropicKey

Write-Host "Configured environment for Claude Code (this session):"
Write-Host "  ANTHROPIC_BASE_URL=$($env:ANTHROPIC_BASE_URL)"
Write-Host "  ANTHROPIC_API_KEY=$($env:ANTHROPIC_API_KEY)"

# Update NO_PROXY/no_proxy to bypass localhost
function Merge-NoProxy([string]$current) {
  if ([string]::IsNullOrEmpty($current)) { return "localhost,127.0.0.1" }
  $items = $current.Split(",") | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" }
  if (-not ($items -contains "localhost")) { $items += "localhost" }
  if (-not ($items -contains "127.0.0.1")) { $items += "127.0.0.1" }
  return ($items -join ",")
}

$env:NO_PROXY = Merge-NoProxy $env:NO_PROXY
$env:no_proxy = Merge-NoProxy $env:no_proxy

if ($Persist) {
  # Persist to User environment
  [Environment]::SetEnvironmentVariable("ANTHROPIC_BASE_URL", $baseUrl, "User")
  [Environment]::SetEnvironmentVariable("ANTHROPIC_API_KEY", $AnthropicKey, "User")

  $uNoProxy = [Environment]::GetEnvironmentVariable("NO_PROXY", "User")
  $uNoProxy = Merge-NoProxy $uNoProxy
  [Environment]::SetEnvironmentVariable("NO_PROXY", $uNoProxy, "User")

  $ulNoProxy = [Environment]::GetEnvironmentVariable("no_proxy", "User")
  $ulNoProxy = Merge-NoProxy $ulNoProxy
  [Environment]::SetEnvironmentVariable("no_proxy", $ulNoProxy, "User")

  Write-Host "Persisted User environment variables. You may need to restart apps for changes to take effect."
}

Write-Host "To run Claude Code CLI: claude --model claude-3-5-sonnet-20241022"