# build-backend.ps1
# Freezes the FastAPI backend + the built SPA into ONE sidecar exe (mellow-backend.exe)
# and drops it where Tauri expects it: desktop/src-tauri/binaries/<triple>/
$ErrorActionPreference = "Stop"

$root   = Split-Path $PSScriptRoot -Parent
$backend  = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"
$venvPy   = Join-Path $backend ".venv\Scripts\python.exe"
$triple   = "x86_64-pc-windows-msvc"
# Tauri's externalBin naming convention: <name>-<target-triple>.exe, flat in binaries/
$destDir  = Join-Path $root "desktop\src-tauri\binaries"
$destExe  = Join-Path $destDir "mellow-backend-$triple.exe"

# 1) SPA must be built before freezing (it gets embedded into the exe)
Push-Location $frontend
if (-not (Test-Path "dist\index.html")) {
    Write-Host ">> Building SPA..."
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "SPA build failed" }
}
Pop-Location

# 2) make sure the backend venv can freeze
& $venvPy -m pip install --quiet pyinstaller
if ($LASTEXITCODE -ne 0) { throw "pyinstaller install failed" }

# 3) freeze — onefile so the sidecar is a single exe for Tauri
#    cwd = frontend, so "dist" is the source and lands at <bundle>/frontend/dist
Push-Location $frontend
& $venvPy -m PyInstaller --noconfirm --onefile `
    --name mellow-backend `
    --distpath (Join-Path $backend "dist") `
    --workpath (Join-Path $backend "build") `
    --add-data "dist;frontend/dist" `
    (Join-Path $backend "api.py")
if ($LASTEXITCODE -ne 0) { throw "PyInstaller failed" }
Pop-Location

# 4) ship it to the Tauri sidecar slot
New-Item -ItemType Directory -Force -Path $destDir | Out-Null
Copy-Item (Join-Path $backend "dist\mellow-backend.exe") $destExe -Force

Write-Host "`nBackend sidecar ready: $destExe"
