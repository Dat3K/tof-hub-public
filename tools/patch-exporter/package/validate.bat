@echo off
setlocal enabledelayedexpansion
title Tower of Fantasy - Validate Datasets

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

if "%~1"=="" (
    echo =======================================================================
    echo [USAGE]
    echo   validate.bat --input ^<staged_dir^> [options]
    echo.
    echo Options:
    echo   --input ^<dir^>           Directory containing staged game-data or deploy root
    echo   --strict                Fail on warnings in addition to fatal errors
    echo   --require-changelog     Require valid baseline (fatal if missing)
    echo   --package ^<dir^>         Validate portable package prerequisites
    echo   --verbose               Show verbose check details
    echo =======================================================================
)

rem Isolate PATH: eliminate global Node, Python, pnpm, and Git; keep system binaries and bundled tools
set "PATH=%SystemRoot%\system32;%SystemRoot%;%SystemRoot%\System32\Wbem;%SCRIPT_DIR%bin"

"%NODE_EXE%" "%SCRIPT_DIR%scripts\cli.js" validate %*
exit /b !ERRORLEVEL!
