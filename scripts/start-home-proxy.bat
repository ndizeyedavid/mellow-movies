@echo off
REM Mellow Home Proxy - double-click me
REM Starts local forward proxy + Cloudflare Tunnel for residential egress
powershell -ExecutionPolicy Bypass -File "%~dp0start-home-proxy.ps1" %*
pause
