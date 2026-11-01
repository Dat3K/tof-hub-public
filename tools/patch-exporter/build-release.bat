@echo off
rem Builds dist\ToFExporter.exe for a helper with the game.
rem Needs Node + npm, Visual C++ x64 Build Tools + Windows SDK.
rem Pass --zip to also create the old portable ZIP.
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-release.ps1" %*
set "CODE=%ERRORLEVEL%"
if "%CODE%"=="0" (
  echo.
  echo Done: %~dp0dist\ToFExporter.exe
) else (
  echo.
  echo Package build failed with code %CODE%.
)
pause
exit /b %CODE%
