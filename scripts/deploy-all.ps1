# Wahy Wa Namaa — branch verification & PR push helper
# Direct pushes to master are forbidden per AGENTS.md; push feature/security branches and open a PR.

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$branch = (git rev-parse --abbrev-ref HEAD).Trim()
if ($branch -eq 'master' -or $branch -eq 'main') {
  throw "Refusing to push directly to '$branch'. Create a branch and open a Pull Request so CI runs first."
}

Write-Host "=== Wahy Wa Namaa release check ($branch) ===" -ForegroundColor Cyan

Write-Host "[1/4] Frontend build..." -ForegroundColor Yellow
npm ci --ignore-scripts --no-audit --no-fund
npm run build --ignore-scripts -- --emptyOutDir

Write-Host "[2/4] Backend syntax & security check..." -ForegroundColor Yellow
Push-Location backend
npm ci --ignore-scripts --no-audit --no-fund
npm run check
npm run test:security
Pop-Location

Write-Host "[3/4] Push branch '$branch'..." -ForegroundColor Yellow
$status = git status --porcelain
if ($status) {
  throw "Working tree has uncommitted changes. Review and stage files explicitly (never blind git add -A)."
}
git push -u origin $branch

Write-Host "[4/4] Live production readiness probe..." -ForegroundColor Yellow
$api = Invoke-RestMethod "https://api.wahywanamaa.com/api/readiness"
Write-Host "API ready: $($api.ready)"
$proxy = Invoke-RestMethod "https://wahywanamaa.com/api/readiness"
Write-Host "Frontend proxy ready: $($proxy.ready)"
Write-Host "Frontend: https://wahywanamaa.com"
Write-Host "Backend:  https://api.wahywanamaa.com"
