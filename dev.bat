@echo off
title MovieBox Dev Launcher
cd /d "%~dp0"

if /i "%~1"=="start"   goto start
if /i "%~1"=="stop"    goto stop
if /i "%~1"=="restart" goto restart

:menu
cls
echo ============================================
echo   MovieBox Dev Launcher
echo ============================================
echo   1) Start dev servers
echo   2) Stop dev servers
echo   3) Restart dev servers
echo   4) Exit
echo ============================================
echo   Tip: dev.bat start^|stop^|restart
echo ============================================
set "choice="
set /p "choice=Choose [1-4]: "

if "%choice%"=="1" goto start
if "%choice%"=="2" goto stop
if "%choice%"=="3" goto restart
if "%choice%"=="4" goto end
echo Invalid choice, try again.
timeout /t 1 /nobreak >nul
goto menu

:start
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\start-dev.ps1"
goto done

:stop
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\stop-dev.ps1"
goto done

:restart
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\stop-dev.ps1"
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\start-dev.ps1"
goto done

:done
echo.
if "%~1"=="" pause

:end
exit /b 0
