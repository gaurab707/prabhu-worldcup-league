@echo off
REM ============================================================
REM  Prabhu Capital World Cup League - Frontend launcher (Windows)
REM  Installs Node dependencies on first run, then starts Vite.
REM ============================================================
setlocal
cd /d "%~dp0\..\frontend"

echo.
echo ========================================================
echo   Prabhu Capital - Prediction League  ^|  FRONTEND
echo ========================================================
echo.

if not exist "node_modules\" (
    echo [setup] Installing Node dependencies (first run, please wait)...
    call npm install
)

if not exist ".env" (
    echo [setup] Creating .env from template...
    copy /y .env.example .env >nul
)

echo.
echo [run] Starting web app on http://0.0.0.0:3000
echo       Open http://localhost:3000 in your browser.
echo       (Press CTRL+C to stop)
echo.
call npm run dev

endlocal
