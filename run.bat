@echo off
title Lunar Rover — AI Mission Control
color 0B
cls

echo.
echo  ============================================================
echo    LUNAR ROVER  ^|  AI Mission Control System
echo    Powered by: Gymnasium + Q-Learning + Three.js
echo  ============================================================
echo.
echo  [*] Checking dependencies...
python -c "import fastapi, uvicorn, gymnasium, numpy" 2>nul
if %errorlevel% neq 0 (
    echo  [!] Installing required packages...
    pip install fastapi uvicorn gymnasium numpy pygame -q
)
echo  [+] Dependencies OK
echo.
echo  [*] Starting Mission Control Server on port 8000...
echo  [*] Browser will open automatically in 2 seconds...
echo.
echo  ============================================================
echo    To stop: Press Ctrl+C in this window
echo  ============================================================
echo.

cd /d "%~dp0"
python -m uvicorn server.app:app --host 127.0.0.1 --port 8000 --log-level warning

pause
