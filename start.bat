@echo off
chcp 65001 >nul
title Game Daily Tracker Launcher
color 0B

echo ================================================
echo    Game Daily Task Tracker - Startup Script
echo ================================================
echo.

REM Check if MongoDB is running
echo [1/3] Checking MongoDB status...
sc query MongoDB | find "RUNNING" >nul
if %errorlevel% neq 0 (
    echo   MongoDB service not running, attempting to start...
    net start MongoDB >nul 2>&1
    if %errorlevel% neq 0 (
        echo   [WARNING] Unable to start MongoDB automatically
        echo   Please start it manually or check if MongoDB is installed correctly
        pause
        exit /b 1
    )
)
echo   MongoDB is running
echo.

REM Start Backend
echo [2/3] Starting Backend Server (Port 8001)...
start "Backend Server - Game Tracker" cmd /k "cd /d %~dp0backend && uvicorn server:app --host 0.0.0.0 --port 8001 --reload"
timeout /t 3 /nobreak >nul
echo   Backend startup command sent
echo.

REM Start Frontend
echo [3/3] Starting Frontend Server (Port 3000)...
start "Frontend Server - Game Tracker" cmd /k "cd /d %~dp0frontend && yarn start"
echo   Frontend startup command sent
echo.

echo ================================================
echo    All services starting!
echo.
echo    Backend:  http://localhost:8001
echo    Frontend: http://localhost:3000
echo.
echo    Browser will open automatically in ~15 seconds
echo    To stop services, run stop.bat
echo ================================================
echo.
echo Press any key to close this window...
pause >nul
