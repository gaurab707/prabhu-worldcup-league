@echo off
REM ============================================================
REM  Prabhu League - Website launcher (Windows)
REM  Runs the frontend on http://localhost:3000
REM  You can double-click this file directly to start ONLY the
REM  website, as long as SETUP_AND_RUN.bat has been run once already.
REM ============================================================
title Prabhu League - Website (port 3000)
cd /d "%~dp0frontend"
color 0B
echo ============================================================
echo   Prabhu League  -  Website
echo ------------------------------------------------------------
echo   Open     http://localhost:3000
echo   To stop  press CTRL+C or just close this window
echo ============================================================
echo.

if not exist "node_modules" (
  color 0C
  echo [ERROR] The web packages are missing.
  echo         Run SETUP_AND_RUN.bat once to install everything, then retry.
  echo.
  pause
  exit /b 1
)

call npm run dev

color 0C
echo.
echo ============================================================
echo   The website has STOPPED.
echo   If an error above mentions port 3000 is already in use,
echo   close whatever is using port 3000, then run this file again.
echo ============================================================
echo.
pause
exit /b 0
