# ============================================
# Claude Code + Bedrock + agent-browser (AgentCore)
# ============================================
# 1) انسخ Bedrock API key من AWS Console (Bedrock > API keys)
# 2) شغّل: .\scripts\setup-bedrock-claude.ps1 -BedrockApiKey "YOUR_KEY"

param(
    [Parameter(Mandatory = $false)]
    [Security.SecureString]$BedrockApiKeySecure,
    [string]$Region = "us-east-1"
)

$ErrorActionPreference = "Stop"

if (-not $BedrockApiKeySecure) {
    $BedrockApiKeySecure = Read-Host -Prompt "Enter AWS Bedrock API Key" -AsSecureString
}
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($BedrockApiKeySecure)
try {
    $BedrockApiKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
} finally {
    if ($bstr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    }
}
if (-not $BedrockApiKey) {
    throw "Bedrock API key is required."
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Bedrock + Claude Code + agent-browser" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Claude Code (وكيل برمجي)
$claudeSettingsDir = Join-Path $env:USERPROFILE ".claude"
$claudeSettings = Join-Path $claudeSettingsDir "settings.json"

if (-not (Test-Path $claudeSettingsDir)) {
    New-Item -ItemType Directory -Path $claudeSettingsDir | Out-Null
}

$settings = @{
    env = @{
        CLAUDE_CODE_USE_BEDROCK       = "1"
        AWS_REGION                    = $Region
        AWS_BEARER_TOKEN_BEDROCK      = $BedrockApiKey
        ANTHROPIC_DEFAULT_SONNET_MODEL = "global.anthropic.claude-sonnet-4-5-20250929-v1:0"
        ANTHROPIC_DEFAULT_HAIKU_MODEL  = "us.anthropic.claude-haiku-4-5-20251001-v1:0"
    }
}

if (Test-Path $claudeSettings) {
    $existing = Get-Content $claudeSettings -Raw | ConvertFrom-Json
    if ($existing.env) {
        foreach ($k in $settings.env.Keys) { $existing.env | Add-Member -NotePropertyName $k -NotePropertyValue $settings.env[$k] -Force }
    } else {
        $existing | Add-Member -NotePropertyName env -NotePropertyValue $settings.env
    }
    $settings = $existing
}

$settings | ConvertTo-Json -Depth 5 | Set-Content $claudeSettings -Encoding UTF8
Write-Host "[OK] Claude Code settings -> $claudeSettings" -ForegroundColor Green

# Never persist plaintext bearer tokens in Microsoft.PowerShell_profile.ps1.
$env:AGENT_BROWSER_PROVIDER = "agentcore"
$env:AGENTCORE_REGION = $Region
$env:AWS_BEARER_TOKEN_BEDROCK = $BedrockApiKey
Write-Host "[OK] agent-browser env set for current session only (not written to shell profile)" -ForegroundColor Green

# backend .env (اختياري)
$backendEnv = Join-Path $PSScriptRoot "..\backend\.env"
$envExample = Join-Path $PSScriptRoot "..\backend\.env.example"
if (-not (Test-Path $backendEnv) -and (Test-Path $envExample)) {
    Copy-Item $envExample $backendEnv
}
if (Test-Path $backendEnv) {
    $lines = Get-Content $backendEnv
    $map = @{
        "AWS_REGION="               = "AWS_REGION=$Region"
        "AWS_BEARER_TOKEN_BEDROCK=" = "AWS_BEARER_TOKEN_BEDROCK=$BedrockApiKey"
        "BEDROCK_MODEL="            = "BEDROCK_MODEL=global.anthropic.claude-sonnet-4-5-20250929-v1:0"
    }
    foreach ($key in $map.Keys) {
        $prefix = ($key -split "=")[0]
        $lines = $lines | Where-Object { $_ -notmatch "^$prefix=" }
        $lines += $map[$key]
    }
    $lines | Set-Content $backendEnv
    Write-Host "[OK] backend\.env updated" -ForegroundColor Green
}

Write-Host "`nاختبار Claude Code:" -ForegroundColor Yellow
Write-Host "  claude" -ForegroundColor White
Write-Host "  /setup-bedrock" -ForegroundColor White
Write-Host "`nاختبار agent-browser (AgentCore):" -ForegroundColor Yellow
Write-Host "  agent-browser -p agentcore open https://example.com" -ForegroundColor White
Write-Host "`nملاحظة: فعّل نماذج Anthropic من Model catalog بعد حل صلاحيات IAM." -ForegroundColor Magenta
