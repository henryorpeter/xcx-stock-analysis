param(
  [switch]$Wait
)

$ErrorActionPreference = 'Stop'

Write-Host 'Building React UI (static assets)...'
Push-Location 'apps\dsa-web'
if (!(Test-Path 'node_modules')) {
  npm install
}
npm run build
Pop-Location

Write-Host 'Starting Electron desktop (dev mode)...'
Push-Location 'apps\dsa-desktop'
if (!(Test-Path 'node_modules')) {
  npm install
}
if ($Wait) {
  npm run dev
} else {
  Start-Process -FilePath 'npm.cmd' -ArgumentList @('run', 'dev') -WorkingDirectory (Get-Location).Path | Out-Null
  Write-Host 'Electron desktop started in a detached process. Use -Wait to keep it attached to the current shell.'
}
Pop-Location
