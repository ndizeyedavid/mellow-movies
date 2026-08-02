# ============================================================
#  MovieBox local dev stopper
#  Closes backend (8000) and frontend (5173) if running.
# ============================================================
$BackendPort  = 8000
$FrontendPort = 5173

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

# Order matters: kill uvicorn reloader parents FIRST so they can't
# respawn their child while we kill the port listeners below.
function Invoke-KillSweep {
    Stop-Matching "uvicorn.*api:app" "backend (uvicorn)"
    Stop-Matching "spawn_main" "backend (uvicorn worker)"
    Stop-Matching "node_modules[\\/]vite" "frontend (vite)"
    Stop-Listeners $BackendPort  "backend"
    Stop-Listeners $FrontendPort "frontend"
}

Write-Host "== Closing dev servers =="
Invoke-KillSweep
Start-Sleep -Seconds 1
Invoke-KillSweep
Start-Sleep -Seconds 1

$stillBusy = Get-NetTCPConnection -LocalPort $BackendPort,$FrontendPort -State Listen -ErrorAction SilentlyContinue
if ($stillBusy) {
    Write-Host ("  still busy: port(s) {0}" -f ($stillBusy.LocalPort -join ",")) -ForegroundColor Yellow
} else {
    Write-Host "All closed." -ForegroundColor Green
}
