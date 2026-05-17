@echo off
cd /d "%~dp0"
echo Starting PhotoCompare at http://localhost:4173
echo Keep this window open while using the app.
python -m http.server 4173
pause
