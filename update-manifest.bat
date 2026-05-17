@echo off
cd /d "%~dp0"
echo Updating PhotoCompare manifest...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\generate-manifest.ps1"
echo.
echo Done. You can close this window.
pause
