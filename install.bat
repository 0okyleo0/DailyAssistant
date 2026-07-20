@echo off
chcp 65001 >nul
title Install Game Daily Tracker
color 0A

echo ================================================
echo   Game Daily Task Tracker - First-time Installer
echo ================================================
echo.

REM Check Python
echo [1/4] Checking Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo   [ERROR] Python not found
    echo   Please install Python 3.10+ from https://www.python.org/downloads/
    pause
    exit /b 1
)
echo   Python OK
echo.

REM Check Node.js
echo [2/4] Checking Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo   [ERROR] Node.js not found
    echo   Please install Node.js 18+ from https://nodejs.org/
    pause
    exit /b 1
)
echo   Node.js OK
echo.

REM Check Yarn
echo [3/4] Checking Yarn...
yarn --version >nul 2>&1
if %errorlevel% neq 0 (
    echo   Yarn not installed, installing...
    call npm install -g yarn
)
echo   Yarn OK
echo.

REM Install Backend Dependencies
echo [4/4] Installing dependencies...
echo   Installing backend dependencies...
cd /d %~dp0backend
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo   [ERROR] Backend installation failed
    pause
    exit /b 1
)
echo   Backend dependencies installed
echo.

echo   Installing frontend dependencies (may take a few minutes)...
cd /d %~dp0frontend
call yarn install
if %errorlevel% neq 0 (
    echo   [ERROR] Frontend installation failed
    pause
    exit /b 1
)
echo   Frontend dependencies installed
echo.

echo ================================================
echo    Installation Complete!
echo.
echo    Next steps:
echo    1. Ensure MongoDB is installed and running
echo    2. Double-click start.bat to launch the app
echo ================================================
echo.
pause
