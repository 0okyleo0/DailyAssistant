@echo off
chcp 65001 >nul
title Stop Game Daily Tracker
color 0C

echo ================================================
echo    Stopping Game Daily Task Tracker Services
echo ================================================
echo.

echo [1/2] Stopping Backend Server...
taskkill /FI "WINDOWTITLE eq Backend Server - Game Tracker*" /F >nul 2>&1
echo   Backend stopped
echo.

echo [2/2] Stopping Frontend Server...
taskkill /FI "WINDOWTITLE eq Frontend Server - Game Tracker*" /F >nul 2>&1
echo   Frontend stopped
echo.

echo ================================================
echo    All services stopped
echo ================================================
echo.
timeout /t 2 /nobreak >nul
