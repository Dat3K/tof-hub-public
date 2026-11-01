@echo off
setlocal
chcp 65001 >nul
title Tower of Fantasy - site data update

rem One click: game folder -> extract the needed files -> build site data -> output\tof-update-*.zip
rem Extra options are passed through, e.g. RUN.bat --game-path "D:\Tower of Fantasy"

set "SCRIPT_DIR=%~dp0"
set "NODE_EXE=%SCRIPT_DIR%runtime\node.exe"
if not exist "%NODE_EXE%" (
  echo [ERROR] runtime\node.exe is missing. Extract the whole archive and run again.
  pause
  exit /b 1
)

rem Use every core for compression and image work; keep system binaries plus bundled tools.
set "UV_THREADPOOL_SIZE=%NUMBER_OF_PROCESSORS%"
set "PATH=%SystemRoot%\system32;%SystemRoot%;%SystemRoot%\System32\Wbem;%SystemRoot%\System32\WindowsPowerShell\v1.0;%SCRIPT_DIR%bin"

"%NODE_EXE%" --max-old-space-size=4096 "%SCRIPT_DIR%scripts\cli.js" run %*
set "CODE=%ERRORLEVEL%"
echo.
if not "%CODE%"=="0" echo [ERROR] Update failed (code %CODE%). Send the window text and the output\site\pre-release folder to the site maintainer.
pause
exit /b %CODE%
