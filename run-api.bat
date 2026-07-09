@echo off
REM ============================================================
REM  Prabhu League - API server launcher (Windows)
REM  Runs the backend on http://localhost:8000
REM  You can double-click this file directly to start ONLY the API,
REM  as long as SETUP_AND_RUN.bat has been run once already.
REM ============================================================
title Prabhu League - API (port 8000)
cd /d "%~dp0backend"
color 0B
echo ============================================================
echo   Prabhu League  -  API server
echo ------------------------------------------------------------
echo   URL      http://localhost:8000
echo   Docs     http://localhost:8000/docs
echo   To stop  press CTRL+C or just close this window
echo ============================================================
echo.

if not exist ".venv\Scripts\python.exe" (
  color 0C
  echo [ERROR] The Python environment is missing.
  echo         Run SETUP_AND_RUN.bat once to install everything, then retry.
  echo.
  pause
  exit /b 1
)

".venv\Scripts\python.exe" -m uvicorn app.main:app --host 0.0.0.0 --port 8000

color 0C
echo.
echo ============================================================
echo   The API server has STOPPED.
echo   If an error above mentions "address already in use" or 10048,
echo   port 8000 is taken - close whatever is using it, then run
echo   this file again.
echo ============================================================
echo.
pause
exit /b 0
