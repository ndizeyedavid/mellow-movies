# ============================================================
#  MovieBox local dev runner
#  1. Closes any backend (8000) / frontend (5173) already up
#  2. Boots backend (uvicorn) + frontend (vite) fresh
#  Logs: .logs\  inside the project. Stop: dev.bat (root)
# ============================================================
$ErrorActionPreference = "Stop"

$Root     = Split-Path -Parent $PSScriptRoot
$Backend  = Join-Path $Root "backend"
$Frontend = Join-Path $Root "frontend"
$LogDir   = Join-Path $Root ".logs"

$BackendPort  = 8000
$FrontendPort = 5173

# ---------- kill helpers ----------
function Stop-Listeners([int]$Port, [string]$Name) {
    try {
        $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        foreach ($conn in $conns) {
            foreach ($procId in @($conn.OwningProcess | Sort-Object -Unique)) {
                $p = Get-Process -Id $procId -ErrorAction SilentlyContinue
                if ($p) {
                    Write-Host ("  closing {0} (PID {1}) on port {2}" -f $Name, $procId, $Port)
                    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
                }
            }
        }
    } catch { }
}

function Stop-Matching([string]$Pattern, [string]$Name) {
    $procs = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
        Where-Object { $_.CommandLine -and $_.CommandLine -match $Pattern }
    foreach ($proc in $procs) {
        if ($proc.ProcessId -eq $PID) { continue }
        Write-Host ("  closing {0} (PID {1})" -f $Name, $proc.ProcessId)
        Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
    }
}

# ---------- close anything already running ----------
# Order matters: kill uvicorn reloader parents FIRST so they can't
# respawn their child while we kill the port listeners below.
function Invoke-KillSweep {
    Stop-Matching "uvicorn.*api:app" "backend (uvicorn)"
    Stop-Matching "spawn_main" "backend (uvicorn worker)"
    Stop-Matching "node_modules[\\/]vite" "frontend (vite)"
    Stop-Listeners $BackendPort  "backend"
    Stop-Listeners $FrontendPort "frontend"
}

Write-Host "== Closing existing dev servers =="
Invoke-KillSweep
Start-Sleep -Seconds 1
Invoke-KillSweep
Start-Sleep -Seconds 1

$stillBusy = Get-NetTCPConnection -LocalPort $BackendPort,$FrontendPort -State Listen -ErrorAction SilentlyContinue
if ($stillBusy) {
    Write-Host ("ERROR: port(s) {0} still busy after cleanup, close them manually." -f ($stillBusy.LocalPort -join ",")) -ForegroundColor Red
    exit 1
}

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

# ---------- backend ----------
$py = Join-Path $Backend ".venv\Scripts\python.exe"
if (-not (Test-Path $py)) {
    Write-Host "ERROR: no virtualenv at $py" -ForegroundColor Red
    Write-Host "Create it first:  cd backend ; python -m venv .venv ; .venv\Scripts\pip install -r requirements.txt"
    exit 1
}

Write-Host "== Starting backend  ->  http://localhost:$BackendPort =="
Start-Process -FilePath $py `
    -ArgumentList "-m","uvicorn","api:app","--host","127.0.0.1","--port","$BackendPort","--reload" `
    -WorkingDirectory $Backend `
    -RedirectStandardOutput (Join-Path $LogDir "backend.log") `
    -RedirectStandardError  (Join-Path $LogDir "backend.err.log") `
    -WindowStyle Hidden

# ---------- frontend ----------
if (-not (Test-Path (Join-Path $Frontend "node_modules"))) {
    Write-Host "== Installing frontend deps (first run) ==" -ForegroundColor Yellow
    Push-Location $Frontend
    & npm.cmd install
    Pop-Location
}

Write-Host "== Starting frontend ->  http://localhost:$FrontendPort =="
Start-Process -FilePath "npm.cmd" `
    -ArgumentList "run","dev","--","--port","$FrontendPort","--strictPort" `
    -WorkingDirectory $Frontend `
    -RedirectStandardOutput (Join-Path $LogDir "frontend.log") `
    -RedirectStandardError  (Join-Path $LogDir "frontend.err.log") `
    -WindowStyle Hidden

Start-Sleep -Seconds 4

Write-Host ""
Write-Host "Frontend : http://localhost:$FrontendPort" -ForegroundColor Green
Write-Host "Backend  : http://localhost:$BackendPort   (API docs: /docs)" -ForegroundColor Green
Write-Host "Logs     : $LogDir"
Write-Host "Orchestrator: dev.bat at the project root"
