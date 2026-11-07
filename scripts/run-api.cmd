@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-api.ps1"
if errorlevel 1 (
  echo.
  echo API startup failed. Review the error above.
  exit /b 1
)
