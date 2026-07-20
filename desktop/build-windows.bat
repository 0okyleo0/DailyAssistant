@echo off
chcp 65001 >nul

REM ================================================
REM Step 0: Self-elevate to Administrator
REM ================================================
REM electron-builder needs to create symbolic links for winCodeSign package
REM which requires admin rights on Windows (unless Developer Mode is enabled)
net session >nul 2>&1
if not "%errorlevel%" == "0" (
    echo.
    echo ================================================
    echo   Need Administrator Privileges
    echo ================================================
    echo.
    echo electron-builder needs to create symbolic links,
    echo which requires administrator privileges on Windows.
    echo.
    echo Requesting UAC elevation to restart...
    echo.
    echo TIP: To avoid this in the future, you can enable Developer Mode:
    echo      Settings ^> Privacy ^& Security ^> For developers ^> Developer Mode
    echo.
    timeout /t 3 /nobreak >nul
    powershell -Command "Start-Process cmd.exe -Verb RunAs -ArgumentList '/k cd /d \"\"%~dp0\"\" ^&^& \"\"%~nx0\"\"'"
    exit /b 0
)

setlocal
title Build Game Daily Tracker Desktop App
color 0A

echo ================================================
echo   Building Game Daily Tracker Desktop App
echo   [Running as Administrator]
echo ================================================
echo.

REM Check Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found. Please install from https://nodejs.org/
    goto :end
)
for /f "delims=" %%v in ('node --version') do echo [OK] Node.js %%v
echo.

REM Check Yarn
where yarn >nul 2>&1
if errorlevel 1 (
    echo Yarn not found, installing globally...
    call npm install -g yarn
    if errorlevel 1 (
        echo [ERROR] Failed to install Yarn
        goto :end
    )
)
for /f "delims=" %%v in ('yarn --version') do echo [OK] Yarn %%v
echo.

REM Show signing status
if defined CSC_LINK (
    echo [SIGNING] Certificate detected: %CSC_LINK%
    echo           Build will be code-signed.
) else (
    echo [SIGNING] No CSC_LINK env var set.
    echo           Build will be UNSIGNED ^(users will see SmartScreen warning^).
    echo           See CODESIGNING.md for details.
)
echo.

echo ================================================
echo [1/4] Installing frontend dependencies...
echo ================================================
pushd "%~dp0..\frontend"
call yarn install
if errorlevel 1 (
    echo.
    echo [ERROR] Frontend dependency installation failed.
    popd
    goto :end
)
popd
echo.

echo ================================================
echo [2/4] Installing desktop dependencies...
echo ================================================
pushd "%~dp0"
call yarn install
if errorlevel 1 (
    echo.
    echo [ERROR] Desktop dependency installation failed.
    popd
    goto :end
)
popd
echo.

echo ================================================
echo [3/4] Building React frontend...
echo ================================================
pushd "%~dp0..\frontend"
call yarn build
if errorlevel 1 (
    echo.
    echo [ERROR] React build failed.
    popd
    goto :end
)
popd
echo.

echo ================================================
echo [4/4] Packaging Electron desktop app...
echo ================================================
pushd "%~dp0"
call yarn electron-builder --win
if errorlevel 1 (
    echo.
    echo [ERROR] Electron packaging failed.
    echo.
    echo Common causes:
    echo   1. Symbolic link error: Enable Windows Developer Mode
    echo      Settings ^> Privacy ^& Security ^> For developers ^> Developer Mode
    echo   2. Network issue downloading electron binary
    echo      Try running again, or set proxy via HTTP_PROXY env var
    echo   3. Antivirus blocking: Add exclusion for this folder
    echo.
    popd
    goto :end
)
popd
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

:end
echo.
echo Press any key to close this window...
pause >nul
endlocal
