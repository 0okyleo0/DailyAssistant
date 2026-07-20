@echo off
chcp 65001 >nul
title Build Game Daily Tracker Desktop App
color 0A

echo ================================================
echo   Building Game Daily Tracker Desktop App
echo ================================================
echo.

REM Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js not found. Please install from https://nodejs.org/
    pause
    exit /b 1
)

REM Check Yarn
where yarn >nul 2>&1
if %errorlevel% neq 0 (
    echo Yarn not found, installing globally...
    call npm install -g yarn
)

REM Show signing status
if defined CSC_LINK (
    echo [SIGNING] Certificate detected: %CSC_LINK%
    echo           Build will be code-signed.
) else (
    echo [SIGNING] No CSC_LINK env var set.
    echo           Build will be UNSIGNED (users will see SmartScreen warning).
    echo           See CODESIGNING.md for details.
)
echo.

echo [1/4] Installing frontend dependencies...
cd /d %~dp0..\frontend
call yarn install
if %errorlevel% neq 0 (
    echo [ERROR] Frontend install failed
    pause
    exit /b 1
)
echo.

echo [2/4] Installing desktop dependencies...
cd /d %~dp0
call yarn install
if %errorlevel% neq 0 (
    echo [ERROR] Desktop install failed
    pause
    exit /b 1
)
echo.

echo [3/4] Building React frontend...
cd /d %~dp0..\frontend
call yarn build
if %errorlevel% neq 0 (
    echo [ERROR] React build failed
    pause
    exit /b 1
)
echo.

echo [4/4] Packaging Electron desktop app...
cd /d %~dp0
call yarn electron-builder --win
if %errorlevel% neq 0 (
    echo [ERROR] Electron packaging failed
    pause
    exit /b 1
)
echo.

echo ================================================
echo    Build Complete!
echo.
echo    Installer:   desktop\dist\GameTracker-Setup-*.exe
echo    Portable:    desktop\dist\GameTracker-Portable-*.exe
if not defined CSC_LINK (
    echo.
    echo    NOTE: Build is UNSIGNED.
    echo    Users will see "Unknown Publisher" warning.
    echo    Read desktop\CODESIGNING.md to enable signing.
)
echo ================================================
echo.
pause
