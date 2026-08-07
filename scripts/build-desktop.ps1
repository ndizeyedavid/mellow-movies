# build-desktop.ps1
# One command to build the whole desktop app:
#   1) build the SPA        (frontend/dist)
#   2) add the splash        (desktop/splash.html -> frontend/dist)
#   3) freeze the backend    (sidecar exe -> src-tauri/binaries)
#   4) compile + bundle the Tauri shell (installer in desktop/src-tauri/target/release)
$ErrorActionPreference = "Stop"

$root     = Split-Path $PSScriptRoot -Parent
$frontend = Join-Path $root "frontend"
$desktop  = Join-Path $root "desktop"

Write-Host "`n>>> 1/4. Building SPA..."
Push-Location $frontend
npm run build
if ($LASTEXITCODE -ne 0) { throw "SPA build failed" }
Pop-Location

Write-Host "`n>>> 2/4. Staging splash screen..."
Copy-Item -Force (Join-Path $desktop "splash.html") (Join-Path $frontend "dist\splash.html")

Write-Host "`n>>> 3/4. Freezing backend sidecar..."
powershell -ExecutionPolicy Bypass -File (Join-Path $root "scripts\build-backend.ps1")
if ($LASTEXITCODE -ne 0) { throw "Backend freeze failed" }

Write-Host "`n>>> 4/4. Compiling + bundling the Tauri shell (first build downloads crates)..."
Push-Location $desktop
npm run tauri build
if ($LASTEXITCODE -ne 0) { throw "Tauri build failed" }
Pop-Location

Write-Host "`nDone. Installer is under desktop\src-tauri\target\release\bundle"