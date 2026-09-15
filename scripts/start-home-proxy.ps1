#Requires -Version 5.1
<#
.SYNOPSIS
  Start a local forward proxy (your residential IP) and expose it via Cloudflare Tunnel.
  Your fastapicloud backend will use it as HOME_TUNNEL_URL (top priority) — when you're
  online movies egress via YOUR home (free, unlimited). When you close this, backend
  auto-falls back to RESIDENTIAL_PROXY (your 3 free webshares) with zero movie stop.

.DESCRIPTION
  1. Starts a tiny HTTP forward proxy on 127.0.0.1:8899 (via `proxy.py` - pip install proxy.py)
  2. Starts `cloudflared tunnel --url http://localhost:8899`
  3. Prints the public https://xxx.trycloudflare.com URL — paste it as HOME_TUNNEL_URL on fastapicloud

.USAGE
  .\scripts\start-home-proxy.ps1              # start proxy + tunnel, prints URL
  .\scripts\start-home-proxy.ps1 -Port 8899   # custom local port
  .\scripts\start-home-proxy.ps1 -NoInstall   # skip pip install check

.NOTES
  Keep this window open while you want home priority. Close it to revert to webshares.
  The tunnel URL changes each run (trycloudflare). For a stable URL, create a named tunnel: `cloudflared tunnel create mellow-home`
#>
param(
  [int]$Port = 8899,
  [switch]$NoInstall
)

$ErrorActionPreference = "Stop"

function Test-Command($cmd) { $null -ne (Get-Command $cmd -ErrorAction SilentlyContinue) }

Write-Host "`n=== Mellow Home Proxy (residential) ===" -ForegroundColor Cyan
Write-Host "Local proxy: 127.0.0.1:$Port  ->  Cloudflare Tunnel  ->  fastapicloud HOME_TUNNEL_URL`n" -ForegroundColor DarkGray

# 1. Ensure proxy.py
if (-not $NoInstall) {
  Write-Host "[1/3] Checking proxy.py..." -ForegroundColor Yellow
  try { python -c "import proxy" 2>$null; $hasProxy = $true } catch { $hasProxy = $false }
  if (-not $hasProxy) {
    Write-Host "      Installing proxy.py (pip install proxy.py)..." -ForegroundColor DarkGray
    python -m pip install -q proxy.py
    Write-Host "      Installed." -ForegroundColor Green
  } else { Write-Host "      proxy.py already installed." -ForegroundColor Green }
}

# 2. Ensure cloudflared
Write-Host "[2/3] Checking cloudflared..." -ForegroundColor Yellow
$cfBin = (Get-Command cloudflared -ErrorAction SilentlyContinue)?.Source
if (-not $cfBin) {
  $cfBin = "C:\Program Files (x86)\cloudflared\cloudflared.exe"
  if (-not (Test-Path $cfBin)) {
    Write-Host "      cloudflared not found. Install:" -ForegroundColor Red
    Write-Host "      winget install --id Cloudflare.cloudflared" -ForegroundColor White
    Write-Host "      or download from https://github.com/cloudflare/cloudflared/releases" -ForegroundColor White
    Write-Host "`n      After install, restart this script." -ForegroundColor Yellow
    exit 1
  }
}
function Invoke-Cf($args) { & $cfBin @args 2>&1 }
Write-Host "      cloudflared found: $(Invoke-Cf @('--version') | Select-Object -First 1) ($cfBin)" -ForegroundColor Green

# 3. Start local forward proxy in background
Write-Host "[3/3] Starting local forward proxy on :$Port ..." -ForegroundColor Yellow
$proxyJob = Start-Job -Name mellow-proxy -ScriptBlock {
  param($p) python -m proxy --port $p --hostname 127.0.0.1 --num-workers 4
  # alternative without proxy.py: python -m http.server style is NOT a forward proxy — must use proxy.py
  # if proxy.py missing, fallback to a tiny forward proxy via http.server is insufficient for httpx `proxy=` param
} -ArgumentList $Port
Start-Sleep -Seconds 2
if ($proxyJob.State -eq "Failed") {
  Write-Host "      Proxy failed to start. Try: python -m proxy --port $Port" -ForegroundColor Red
  Receive-Job $proxyJob -ErrorAction SilentlyContinue | Out-String | Write-Host
  exit 1
}
# Quick port check
try { $c = New-Object System.Net.Sockets.TcpClient; $c.Connect("127.0.0.1", $Port); $c.Close(); Write-Host "      Proxy listening on 127.0.0.1:$Port" -ForegroundColor Green } catch { Write-Host "      Proxy not yet listening, waiting..." -ForegroundColor Yellow; Start-Sleep -Seconds 2 }

Write-Host "`n=== Starting Cloudflare Tunnel (this prints your public URL) ===" -ForegroundColor Cyan
Write-Host "  Copy the https://xxx.trycloudflare.com URL below and paste it as HOME_TUNNEL_URL on fastapicloud.`n" -ForegroundColor White
Write-Host "  Example fastapicloud env:" -ForegroundColor DarkGray
Write-Host '    HOME_TUNNEL_URL=https://abc-1234.trycloudflare.com   (your tunnel URL, include https://)' -ForegroundColor DarkGray
Write-Host '    RESIDENTIAL_PROXY=http://user1:pass1@p1.webshare.io:port, http://user2:pass2@p2.webshare.io:port, http://user3:pass3@p3.webshare.io:port' -ForegroundColor DarkGray
Write-Host "`n  Keep this window OPEN for home priority. Close it to auto-fallback to webshares (no movie stop, 5min cooldown).`n" -ForegroundColor Green
Write-Host "  Health: https://mellow-movies.fastapicloud.dev/health/proxy`n" -ForegroundColor DarkGray

# Stream tunnel output so user sees the URL
try {
  # cloudflared logs the URL to stderr; capture and print
  Invoke-Cf @("tunnel","--url","http://localhost:$Port","--no-autoupdate") | ForEach-Object { Write-Host $_ }
} finally {
  Write-Host "`nTunnel closed. Stopping local proxy..." -ForegroundColor Yellow
  Stop-Job $proxyJob -ErrorAction SilentlyContinue | Out-Null
  Remove-Job $proxyJob -Force -ErrorAction SilentlyContinue | Out-Null
  Write-Host "Done. Backend now falls back to webshares." -ForegroundColor Green
}
