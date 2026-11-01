@echo off
setlocal enabledelayedexpansion
title Tower of Fantasy Game Data Exporter

set "SCRIPT_DIR=%~dp0"
set "NODE_EXE=%SCRIPT_DIR%runtime\node.exe"

if not exist "%NODE_EXE%" (
    echo =======================================================================
    echo [FATAL ERROR] Bundled Node.js runtime not found at:
    echo   %NODE_EXE%
    echo.
    echo Please ensure the portable exporter archive was extracted completely.
    echo Global system PATH node is intentionally disabled to guarantee
    echo deterministic, isolated execution.
    echo =======================================================================
    pause
    exit /b 1
)

echo [INFO] Starting Tower of Fantasy Exporter via bundled runtime...
"%NODE_EXE%" "%SCRIPT_DIR%scripts\cli.js" export %*
exit /b !ERRORLEVEL!
