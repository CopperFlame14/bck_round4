@echo off
cd /d "%~dp0"
echo Starting server (PORT from .env, or 8000)...
python -m backend.main
if errorlevel 1 (
  echo.
  echo If you see "port in use", close the other app using that port or set PORT=3001 in .env
  pause
)
