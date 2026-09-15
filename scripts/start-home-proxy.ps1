#Requires -Version 5.1
<#
.SYNOPSIS
  Start a local forward proxy (your residential IP) and expose it via Cloudflare Tunnel or ngrok.
  Your fastapicloud backend will use it as top priority — when you're online movies egress via YOUR home
  (free, unlimited). When you close this, backend auto-falls back to RESIDENTIAL_PROXY (your 3 free webshares)
  with zero movie stop.

  NEW: No manual paste after reboot — this script auto-pushes the fresh tunnel URL to the backend's
  /api/admin/home-tunnel (dynamic). You just double-click and keep the window open.

.DESCRIPTION
  1. Starts a tiny HTTP forward proxy on 127.0.0.1:8899 (via `proxy.py`)
  2. Starts cloudflared quick tunnel (trycloudflare) OR ngrok if --UseNgrok
  3. Auto-POSTs the public https://xxx.trycloudflare.com URL to the backend

.USAGE
  .\scripts\start-home-proxy.ps1                          # cloudflared trycloudflare (random, auto-pushed)
  .\scripts\start-home-proxy.ps1 -UseNgrok                # ngrok static domain (sign up once: ngrok http 8899)
  .\scripts\start-home-proxy.ps1 -Backend https://mellow-movies.fastapicloud.dev
  .\scripts\start-home-proxy.ps1 -Port 8899 -NoInstall
#>
param(
  [int]$Port = 8899,
  [switch]$UseNgrok,
  [string]$Backend = "https://mellow-movies.fastapicloud.dev",
  [switch]$NoInstall
)

$ErrorActionPreference = "Stop"

Write-Host "`n=== Mellow Home Proxy (residential) ===" -ForegroundColor Cyan
Write-Host "Local proxy: 127.0.0.1:$Port  ->  Tunnel  ->  $Backend (auto-registered)`n" -ForegroundColor DarkGray

# 1. Ensure proxy.py
if (-not $NoInstall) {
  Write-Host "[1/3] Checking proxy.py..." -ForegroundColor Yellow
  $hasProxy = $false
  try { python -c "import proxy" 2>$null; if ($LASTEXITCODE -eq 0) { $hasProxy = $true } } catch {}
  if (-not $hasProxy) {
    Write-Host "      Installing proxy.py..." -ForegroundColor DarkGray
    python -m pip install -q proxy.py
    Write-Host "      Installed." -ForegroundColor Green
  } else { Write-Host "      proxy.py already installed." -ForegroundColor Green }
}

# 2. Resolve tunnel binary
$cfBin = (Get-Command cloudflared -ErrorAction SilentlyContinue)?.Source
if (-not $cfBin -and (Test-Path "C:\Program Files (x86)\cloudflared\cloudflared.exe")) { $cfBin = "C:\Program Files (x86)\cloudflared\cloudflared.exe" }
$ngBin = (Get-Command ngrok -ErrorAction SilentlyContinue)?.Source
if (-not $ngBin) {
  $ngBin = "$env:LOCALAPPDATA\Microsoft\WinGet\Links\ngrok.exe"
  if (-not (Test-Path $ngBin)) { $ngBin = $null }
}

if ($UseNgrok -and -not $ngBin) {
  Write-Host "      ngrok not found. Install: winget install Ngrok.Ngrok" -ForegroundColor Red
  exit 1
}
if (-not $UseNgrok -and -not $cfBin) {
  Write-Host "      cloudflared not found. Install: winget install Cloudflare.cloudflared" -ForegroundColor Red
  exit 1
}

if ($UseNgrok) { Write-Host "[2/3] Using ngrok ($ngBin)" -ForegroundColor Green } else { Write-Host "[2/3] Using cloudflared ($cfBin)" -ForegroundColor Green }

# 3. Start local forward proxy in background
Write-Host "[3/3] Starting local forward proxy on :$Port ..." -ForegroundColor Yellow
$proxyJob = Start-Job -Name mellow-proxy -ScriptBlock {
  param($p) python -m proxy --port $p --hostname 127.0.0.1 --num-workers 4
} -ArgumentList $Port
Start-Sleep -Seconds 2
if ($proxyJob.State -eq "Failed") {
  Write-Host "      Proxy failed to start. Try: python -m proxy --port $Port" -ForegroundColor Red
  Receive-Job $proxyJob -ErrorAction SilentlyContinue | Out-String | Write-Host
  exit 1
}
try { $c = New-Object System.Net.Sockets.TcpClient; $c.Connect("127.0.0.1", $Port); $c.Close(); Write-Host "      Proxy listening on 127.0.0.1:$Port" -ForegroundColor Green } catch { Write-Host "      Proxy not yet listening, waiting..." -ForegroundColor Yellow; Start-Sleep -Seconds 2 }

# Helper: auto-push tunnel URL to backend
function Push-HomeTunnel($url) {
  if (-not $url) { return }
  Write-Host "`n      Auto-registering $url -> $Backend/api/admin/home-tunnel" -ForegroundColor Cyan
  try {
    $body = @{ url = $url } | ConvertTo-Json -Compress
    $r = Invoke-RestMethod -Uri "$Backend/api/admin/home-tunnel" -Method Post -ContentType "application/json" -Body $body -TimeoutSec 12
    Write-Host "      Registered: $($r | ConvertTo-Json -Compress)" -ForegroundColor Green
    Write-Host "      Health: $Backend/health/proxy`n" -ForegroundColor DarkGray
  } catch {
    Write-Host "      Auto-register failed: $_" -ForegroundColor Yellow
    Write-Host "      Fallback: manually set HOME_TUNNEL_URL=$url on fastapicloud env, or just keep this window open and wait 5s and retry." -ForegroundColor DarkGray
  }
}

Write-Host "`n=== Starting Tunnel (keep this window OPEN for home priority) ===" -ForegroundColor Cyan
Write-Host "  Close this window to auto-fallback to webshares (5min cooldown, no movie stop).`n" -ForegroundColor Green

if ($UseNgrok) {
  Write-Host "  Starting ngrok http $Port (free static domain if you ran: ngrok config add-authtoken <token>)`n" -ForegroundColor White
  # ngrok logs to stderr, but we can get public URL via API after it starts
  $ngJob = Start-Job -Name mellow-ngrok -ScriptBlock {
    param($p, $bin) & $bin http $p --log stdout 2>&1
  } -ArgumentList $Port, $ngBin
  Start-Sleep -Seconds 4
  # Poll ngrok API for public URL
  $tries = 0; $pubUrl = $null
  while ($tries -lt 20 -and -not $pubUrl) {
    try {
      $api = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -TimeoutSec 3
      $pubUrl = ($api.tunnels | Where-Object { $_.public_url -like "https://*" } | Select-Object -First 1).public_url
      if ($pubUrl) { Write-Host "  ngrok URL: $pubUrl" -ForegroundColor Cyan; Push-HomeTunnel $pubUrl; break }
    } catch {}
    Start-Sleep -Seconds 1; $tries++
  }
  if (-not $pubUrl) { Write-Host "  ngrok started but API not reachable. Check http://127.0.0.1:4040" -ForegroundColor Yellow }
  Write-Host "  Forwarding to $pubUrl — press Ctrl+C to stop.`n" -ForegroundColor DarkGray
  try { Receive-Job $ngJob -Wait -ErrorAction SilentlyContinue | ForEach-Object { Write-Host $_ } } finally {
    Stop-Job $ngJob -ErrorAction SilentlyContinue | Out-Null; Remove-Job $ngJob -Force -ErrorAction SilentlyContinue | Out-Null
    Stop-Job $proxyJob -ErrorAction SilentlyContinue | Out-Null; Remove-Job $proxyJob -Force -ErrorAction SilentlyContinue | Out-Null
    Write-Host "`nngrok closed. Backend now falls back to webshares." -ForegroundColor Green
  }
} else {
  # cloudflared trycloudflare — capture URL from stderr and auto-push
  Write-Host "  Starting cloudflared tunnel --url http://localhost:$Port (random trycloudflare, auto-pushed)`n" -ForegroundColor White
  $cfJob = Start-Job -Name mellow-cf -ScriptBlock {
    param($p, $bin) & $bin tunnel --url "http://localhost:$p" --no-autoupdate 2>&1
  } -ArgumentList $Port, $cfBin
  $pushed = $false
  try {
    while ($true) {
      $out = Receive-Job $cfJob 2>&1 | Out-String
      if ($out) {
        Write-Host $out -NoNewline
        if (-not $pushed -and $out -match "https://[a-z0-9-]+\.trycloudflare\.com") {
          $m = [regex]::Match($out, "https://[a-z0-9-]+\.trycloudflare\.com")
          if ($m.Success) { Push-HomeTunnel $m.Value; $pushed = $true }
        }
      }
      if ($cfJob.State -eq "Completed" -or $cfJob.State -eq "Failed") { break }
      Start-Sleep -Milliseconds 500
    }
  } finally {
    Stop-Job $cfJob -ErrorAction SilentlyContinue | Out-Null; Remove-Job $cfJob -Force -ErrorAction SilentlyContinue | Out-Null
    Stop-Job $proxyJob -ErrorAction SilentlyContinue | Out-Null; Remove-Job $proxyJob -Force -ErrorAction SilentlyContinue | Out-Null
    Write-Host "`nTunnel closed. Backend now falls back to webshares." -ForegroundColor Green
  }
}
