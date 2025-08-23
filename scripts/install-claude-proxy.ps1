#requires -version 5.1
param(
  [string]$InstallDir = "$env:USERPROFILE\.local\claude-code-proxy",
  [string]$OpenAIKey = "",
  [string]$AnthropicKey = "",
  [string]$OpenAIBaseUrl = "https://api.openai.com/v1",
  [int]$Port = 8082,
  [switch]$NoStart
)

$ErrorActionPreference = 'Stop'

function Test-PortInUse([int]$p) {
  try {
    $tcp = Get-NetTCPConnection -State Listen -LocalPort $p -ErrorAction SilentlyContinue
    return $null -ne $tcp
  } catch { return $false }
}

function Pick-FreePort([int]$start) {
  for ($c = $start; $c -le ($start + 20); $c++) {
    if (-not (Test-PortInUse $c)) { return $c }
  }
  return $start
}

function Ensure-Uv() {
  if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
    Write-Host 'Installing uv...'
    powershell -ExecutionPolicy Bypass -c "irm https://astral.sh/uv/install.ps1 | iex"
    $env:Path = "$env:USERPROFILE\.local\bin;$env:Path"
  }
}

function Replace-Or-Append([string]$file, [string]$key, [string]$value) {
  if (-not (Test-Path $file)) { New-Item -ItemType File -Path $file -Force | Out-Null }
  $content = Get-Content $file -ErrorAction SilentlyContinue
  $pattern = "^$key="
  $replaced = $false
  $new = @()
  foreach ($line in $content) {
    if ($line -match $pattern) {
      $new += "$key=\"$value\""
      $replaced = $true
    } else {
      $new += $line
    }
  }
  if (-not $replaced) { $new += "$key=\"$value\"" }
  Set-Content -Path $file -Value $new -Encoding UTF8
}

# Ensure folder
New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null

# Ensure uv
Ensure-Uv

# Clone or update repo
if (-not (Test-Path (Join-Path $InstallDir '.git'))) {
  git clone https://github.com/fuergaosi233/claude-code-proxy $InstallDir
} else {
  try { git -C $InstallDir pull --ff-only } catch {}
}

# Sync deps
Push-Location $InstallDir
uv sync

# Prepare .env
$envFile = Join-Path $InstallDir '.env'
if (-not (Test-Path $envFile)) { Copy-Item (Join-Path $InstallDir '.env.example') $envFile }

if ($OpenAIKey) { Replace-Or-Append $envFile 'OPENAI_API_KEY' $OpenAIKey }
if ($AnthropicKey) { Replace-Or-Append $envFile 'ANTHROPIC_API_KEY' $AnthropicKey }
Replace-Or-Append $envFile 'OPENAI_BASE_URL' $OpenAIBaseUrl

# Port auto-pick
$selected = $Port
if (Test-PortInUse $selected) {
  $np = Pick-FreePort $selected
  if ($np -ne $selected) { Write-Host "Port $selected busy, using $np"; $selected = $np }
}
Replace-Or-Append $envFile 'PORT' "$selected"

Pop-Location

# Start in background
$logDir = Join-Path $env:USERPROFILE '.cache\claude-code-proxy'
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$logFile = Join-Path $logDir 'server.log'

if (-not $NoStart) {
  try { Get-Process -Name uvicorn -ErrorAction SilentlyContinue | Stop-Process -Force } catch {}
  try { Get-Process -Name python -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '*uv*' } | Stop-Process -Force } catch {}
  $envVars = Get-Content $envFile | ForEach-Object {
    if ($_ -match '^([^=]+)="?(.*)"?$') { [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process') }
  }
  Start-Process -WindowStyle Hidden -FilePath 'uv' -ArgumentList 'run claude-code-proxy' -WorkingDirectory $InstallDir -RedirectStandardOutput $logFile -RedirectStandardError $logFile
  Write-Host "Started on http://127.0.0.1:$selected"
  Write-Host "Logs: $logFile"
}

Write-Host "Configure Claude Code to use: ANTHROPIC_BASE_URL=http://127.0.0.1:$selected"
if ($AnthropicKey) { Write-Host "ANTHROPIC_API_KEY=$AnthropicKey" } else { Write-Host "ANTHROPIC_API_KEY=any-value" }