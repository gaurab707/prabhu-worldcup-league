@echo off
REM ============================================================
REM  Prabhu Capital World Cup League - Start EVERYTHING (Windows)
REM  Opens the backend and frontend each in their own window,
REM  then prints the LAN address colleagues should use.
REM ============================================================
setlocal
cd /d "%~dp0"

echo.
echo ========================================================
echo   Prabhu Capital - World Cup Prediction League
echo   Launching backend + frontend...
echo ========================================================
echo.

start "PC League - Backend"  cmd /k start_backend.bat
timeout /t 3 >nul
start "PC League - Frontend" cmd /k start_frontend.bat

echo.
echo Two windows have opened (backend + frontend).
echo Give them a moment to finish installing on first run.
echo.
call show_ip.bat
echo.
echo   Admin login : admin@prabhucapital.com  /  Admin@123
echo.
pause
endlocal
