@echo off
setlocal enabledelayedexpansion
title Tower of Fantasy - Process Existing Data

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
    echo [USAGE ERROR] Mandatory arguments missing.
    echo.
    echo Usage:
    echo   process-existing.bat --input ^<raw_exports_dir^> --output ^<deploy_dir^> [options]
    echo.
    echo Options:
    echo   --input ^<dir^>          Mandatory: directory containing prepared raw export data
    echo   --output ^<dir^>         Mandatory: target directory for deployable output
    echo   --legacy-source ^<dir^>  Optional: legacy source data directory for localization
    echo   --skip-media           Skip PNG copy and WebP conversion
    echo   --validate             Run full requirement and schema validation
    echo   --verbose              Show verbose progress details
    echo =======================================================================
    exit /b 1
)

rem Isolate PATH: eliminate global Node, Python, pnpm, and Git; keep system binaries and bundled tools
set "PATH=%SystemRoot%\system32;%SystemRoot%;%SystemRoot%\System32\Wbem;%SCRIPT_DIR%bin"

"%NODE_EXE%" "%SCRIPT_DIR%scripts\process-existing.js" %*
exit /b !ERRORLEVEL!
