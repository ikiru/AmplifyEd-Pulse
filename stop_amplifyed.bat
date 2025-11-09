@echo off
chcp 65001 >nul
color 0c
title AmplifyEd Pulse Shutdown

echo ============================================================
echo          🔻  AMPLIFYED PULSE - SHUTDOWN  🔻
echo ============================================================
echo.

REM --- Kill Node.js process ---
echo [NODE] Stopping Node server...
taskkill /F /IM node.exe >nul 2>&1
if %errorlevel%==0 (
    echo [NODE] Node server stopped successfully.
) else (
    echo [NODE] No active Node server found.
)

REM --- Kill Python FastAPI process ---
echo.
echo [AI] Stopping FastAPI (Python) microservice...
taskkill /F /IM python.exe >nul 2>&1
taskkill /F /IM uvicorn.exe >nul 2>&1
if %errorlevel%==0 (
    echo [AI] FastAPI microservice stopped successfully.
) else (
    echo [AI] No active FastAPI process found.
)

echo.
echo ============================================================
echo ✅  All AmplifyEd Pulse services have been shut down.
echo ============================================================
echo.
pause
