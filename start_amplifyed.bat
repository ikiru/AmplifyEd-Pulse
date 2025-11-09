@echo off
chcp 65001 >nul
color 0a
title AmplifyEd Pulse Startup

echo ============================================================
echo      AMPLIFYED PULSE - STARTUP
echo ============================================================
echo.

REM Go to the project root
cd /d C:\Users\18303\OneDrive\Documents\code\amplifyed-pulse

REM ---------- Start Node.js server in its own window ----------
echo [NODE] Launching Node server at http://localhost:3000 ...
start "AmplifyEd Node Server" cmd /k "cd /d C:\Users\18303\OneDrive\Documents\code\amplifyed-pulse && node server.js"

REM ---------- Start Python FastAPI microservice in THIS window ----------
echo [AI] Starting Python FastAPI microservice on port 8001...
echo [AI] (Logs below are from the AI service. Press Ctrl+C here to stop it.)
echo.

C:\Users\18303\OneDrive\Documents\code\amplifyed-pulse\yesand_ai_sandbox\.venv\Scripts\python.exe -m uvicorn ai.train_and_serve:app --reload --port 8001

REM When uvicorn stops, we get here
echo.
echo [AI] FastAPI server stopped.
echo.
pause
