#Requires -Version 5.1
<#
.SYNOPSIS
  Start the Mellow home relay (your residential IP) and expose it via tunnel.
  Backend uses it as top priority; close this to auto-fallback to webshares.

  Relay (NOT forward proxy): python scripts/home-relay.py on 127.0.0.1:8900
  exposes GET /health and GET /fetch?u=<cdn>. Cloudflare/ngrok tunnels forward
  plain HTTP, so no CONNECT is needed (forward proxy.py via tunnel is blocked
  by Cloudflare's HTTP edge).

.USAGE
  .\scripts\start-home-proxy.ps1                          # cloudflared trycloudflare (auto-pushed)
  .\scripts\start-home-proxy.ps1 -UseNgrok                # ngrok http 8900 (needs: ngrok config add-authtoken)
  .\scripts\start-home-proxy.ps1 -Backend https://mellow-movies.fastapicloud.dev
  .\scripts\start-home-proxy.ps1 -Port 8900
#>
param(
  [int]$Port = 8900,
  [switch]$UseNgrok,
  [string]$Backend = "https://mellow-movies.fastapicloud.dev"
)

$ErrorActionPreference = "Continue"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RelayScript = Join-Path $ScriptDir "home-relay.py"
$LogDir = Join-Path $env:TEMP "mellow-home"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$RelayLog = Join-Path $LogDir "relay.log"
$TunnelLog = Join-Path $LogDir "tunnel.log"
$TunnelErr = Join-Path $LogDir "tunnel_err.log"

Write-Host "`n=== Mellow Home Relay (residential) ===" -ForegroundColor Cyan
Write-Host "Relay: 127.0.0.1:$Port (/health, /fetch) -> Tunnel -> $Backend (auto-registered)`n" -ForegroundColor DarkGray

function Push-HomeTunnel($url) {
  if (-not $url) { return }
  Write-Host "Auto-registering $url -> $Backend/api/admin/home-tunnel" -ForegroundColor Cyan
  try {
    $body = @{ url = $url } | ConvertTo-Json -Compress
    $r = Invoke-RestMethod -Uri "$Backend/api/admin/home-tunnel" -Method Post -ContentType "application/json" -Body $body -TimeoutSec 12
    Write-Host "Registered: $($r | ConvertTo-Json -Compress)" -ForegroundColor Green
  } catch {
    Write-Host "Auto-register failed: $($_.Exception.Message)" -ForegroundColor Yellow
  }
  Write-Host "Health: $Backend/health/proxy`n" -ForegroundColor DarkGray
}

function Wait-Port($port, $seconds) {
  $deadline = (Get-Date).AddSeconds($seconds)
  while ((Get-Date) -lt $deadline) {
    try { $c = New-Object System.Net.Sockets.TcpClient; $c.Connect("127.0.0.1", $port); $c.Close(); return $true } catch {}
    Start-Sleep -Milliseconds 500
  }
  return $false
}

function Wait-Pattern($file, $pattern, $seconds) {
  $deadline = (Get-Date).AddSeconds($seconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-Path $file) {
      $txt = Get-Content $file -Raw -ErrorAction SilentlyContinue
      if ($txt -and ($txt -match $pattern)) { return ([regex]::Match($txt, $pattern)).Value }
    }
    Start-Sleep -Milliseconds 500
  }
  return $null
}

# 1. Start relay (stdlib, no pip needed)
Write-Host "[1/3] Starting home relay on :$Port ..." -ForegroundColor Yellow
if (-not (Test-Path $RelayScript)) { Write-Host "Missing $RelayScript" -ForegroundColor Red; exit 1 }
# free the port if a stale relay holds it
try {
  $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  foreach ($cc in $conns) { try { Stop-Process -Id $cc.OwningProcess -Force -ErrorAction SilentlyContinue; Write-Host "  Freed stale :$Port (pid $($cc.OwningProcess))" -ForegroundColor DarkGray } catch {} }
} catch {}
Start-Process -FilePath python -ArgumentList "`"$RelayScript`"","--port",$Port -RedirectStandardOutput $RelayLog -WindowStyle Hidden
if (-not (Wait-Port $Port 10)) { Write-Host "Relay did not start in 10s. Log:" -ForegroundColor Red; Get-Content $RelayLog -Tail 20 | Write-Host; exit 1 }
Write-Host "  Relay listening on 127.0.0.1:$Port" -ForegroundColor Green
try {
  $h = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 5
  Write-Host "  Relay /health: $($h | ConvertTo-Json -Compress)" -ForegroundColor Green
} catch { Write-Host "  Relay /health failed: $($_.Exception.Message)" -ForegroundColor Yellow }

# 2. Start tunnel with bounded wait (no endless hangs)
if ($UseNgrok) {
  $ngBin = $null
  $ngCmd = Get-Command ngrok -ErrorAction SilentlyContinue
  if ($ngCmd) { $ngBin = $ngCmd.Source }
  if (-not $ngBin) { $ngBin = "$env:LOCALAPPDATA\Microsoft\WinGet\Links\ngrok.exe" }
  if (-not (Test-Path $ngBin)) { Write-Host "ngrok not found. Run: winget install Ngrok.Ngrok" -ForegroundColor Red; exit 1 }
  Write-Host "[2/3] Starting ngrok http $Port (timeout 25s for URL) ..." -ForegroundColor Yellow
  Remove-Item $TunnelLog, $TunnelErr -ErrorAction SilentlyContinue
  Start-Process -FilePath $ngBin -ArgumentList "http",$Port,"--log","stdout" -RedirectStandardOutput $TunnelLog -RedirectStandardError $TunnelErr -WindowStyle Hidden
  Start-Sleep -Seconds 4
  $pubUrl = $null; $tries = 0
  while ($tries -lt 6 -and -not $pubUrl) {
    try {
      $api = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -TimeoutSec 3
      $pubUrl = ($api.tunnels | Where-Object { $_.public_url -like "https://*" } | Select-Object -First 1).public_url
    } catch {}
    if (-not $pubUrl) { Start-Sleep -Seconds 2; $tries++ }
  }
  if (-not $pubUrl) { Write-Host "ngrok URL not captured in ~16s. Check http://127.0.0.1:4040" -ForegroundColor Red; exit 1 }
  Write-Host "  ngrok URL: $pubUrl" -ForegroundColor Cyan
  Push-HomeTunnel $pubUrl
} else {
  $cfBin = $null
  $cfCmd = Get-Command cloudflared -ErrorAction SilentlyContinue
  if ($cfCmd) { $cfBin = $cfCmd.Source }
  if (-not $cfBin -and (Test-Path "C:\Program Files (x86)\cloudflared\cloudflared.exe")) { $cfBin = "C:\Program Files (x86)\cloudflared\cloudflared.exe" }
  if (-not (Test-Path $cfBin)) { Write-Host "cloudflared not found. Run: winget install Cloudflare.cloudflared" -ForegroundColor Red; exit 1 }
  Write-Host "[2/3] Starting cloudflared quick tunnel (timeout 30s for URL) ..." -ForegroundColor Yellow
  Remove-Item $TunnelLog, $TunnelErr -ErrorAction SilentlyContinue
  Start-Process -FilePath $cfBin -ArgumentList "tunnel","--url","http://localhost:$Port","--no-autoupdate" -RedirectStandardOutput $TunnelLog -RedirectStandardError $TunnelErr -WindowStyle Hidden
  $pubUrl = Wait-Pattern $TunnelErr "https://[a-z0-9-]+\.trycloudflare\.com" 30
  if (-not $pubUrl) { $pubUrl = Wait-Pattern $TunnelLog "https://[a-z0-9-]+\.trycloudflare\.com" 5 }
  if (-not $pubUrl) { Write-Host "Tunnel URL not captured in 30s. Tail:" -ForegroundColor Red; Get-Content $TunnelErr -Tail 10 | Write-Host; exit 1 }
  Write-Host "  Tunnel URL: $pubUrl" -ForegroundColor Cyan
  Push-HomeTunnel $pubUrl
}

Write-Host "[3/3] Verifying relay THROUGH tunnel (timeout 25s) ..." -ForegroundColor Yellow
try {
  $probe = Invoke-RestMethod -Uri "$pubUrl/health" -TimeoutSec 15
  Write-Host "  Tunnel -> relay /health: $($probe | ConvertTo-Json -Compress)" -ForegroundColor Green
} catch {
  Write-Host "  Tunnel health check failed (tunnel may need 10s to propagate): $($_.Exception.Message)" -ForegroundColor Yellow
}
Write-Host "`nKeep this window OPEN for home priority. Close (Ctrl+C) to auto-fallback to webshares." -ForegroundColor Green
Write-Host "Backend health: $Backend/health/proxy`n" -ForegroundColor DarkGray

# Block until Ctrl+C, but with heartbeat: re-push every 5 min so backend never goes stale
try {
  while ($true) { Start-Sleep -Seconds 300; Push-HomeTunnel $pubUrl }
} finally {
  Write-Host "`nStopping relay + tunnel..." -ForegroundColor Yellow
  try {
    $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    foreach ($cc in $conns) { try { Stop-Process -Id $cc.OwningProcess -Force -ErrorAction SilentlyContinue } catch {} }
  } catch {}
  Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Get-Process ngrok -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Write-Host "Done. Backend falls back to webshares." -ForegroundColor Green
}
