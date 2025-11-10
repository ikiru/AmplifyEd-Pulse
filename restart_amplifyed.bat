@echo off
chcp 65001 >nul
color 0e
title AmplifyEd Pulse Restart

echo ╔═══════════════════════════════════════════════════════════════════╗
echo ║                    🔄  AMPLIFYED PULSE - RESTART                  ║
echo ╚═══════════════════════════════════════════════════════════════════╝
echo.

REM --- Step 1: Stop Node.js and FastAPI servers ---
echo [STEP 1] Shutting down existing AmplifyEd Pulse services...
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM python.exe >nul 2>&1
taskkill /F /IM uvicorn.exe >nul 2>&1
echo [INFO] Any running servers have been terminated.
timeout /t 3 >nul

REM --- Step 2: Start fresh servers ---
echo.
echo [STEP 2] Launching new instances...
start "" "%~dp0start_amplifyed.bat"

echo.
echo ╔═══════════════════════════════════════════════════════════════════╗
echo ║ ✅  AmplifyEd Pulse is restarting...                              ║
echo ╚═══════════════════════════════════════════════════════════════════╝
echo.
timeout /t 5 >nul
exit
