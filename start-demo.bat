@echo off
setlocal
title 2026 Safety Month Demo Server

set "APP_DIR=%~dp0"
set "PORT=8787"
set "NODE_EXE=%APP_DIR%portable-node\node.exe"

if not exist "%NODE_EXE%" (
  where node >nul 2>nul
  if errorlevel 1 (
    echo.
    echo [ERROR] Cannot find Node.js.
    echo Please install Node.js 18+ or keep portable-node\node.exe in this folder.
    echo.
    pause
    exit /b 1
  )
  set "NODE_EXE=node"
)

echo.
echo Starting Safety Month app...
echo Local URL: http://localhost:%PORT%/
echo Keep this window open while demonstrating the app.
echo.

start "" "http://localhost:%PORT%/?v=demo-package"
cd /d "%APP_DIR%server"
"%NODE_EXE%" server.js

echo.
echo Server stopped.
pause
