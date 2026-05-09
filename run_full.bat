@echo off
title Lunar Rover - Build and Run
color 0B

cd /d "%~dp0"

echo [1/3] Building frontend (Vite)...
cd frontend
call npm run build
if %errorlevel% neq 0 (
  echo [ERROR] Frontend build failed.
  pause
  exit /b 1
)

echo [2/3] Frontend build OK.
cd /d "%~dp0"

echo [3/3] Starting API server...
python -m uvicorn server.app:app --host 127.0.0.1 --port 8000 --log-level warning

pause
