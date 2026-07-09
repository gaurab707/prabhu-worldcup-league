@echo off
REM ============================================================
REM  Prabhu Capital World Cup League - Backend launcher (Windows)
REM  Creates the virtual environment on first run, installs deps,
REM  seeds the database if empty, then starts the API server.
REM ============================================================
setlocal
cd /d "%~dp0\..\backend"

echo.
echo ========================================================
echo   Prabhu Capital - Prediction League  ^|  BACKEND
echo ========================================================
echo.

if not exist ".venv\" (
    echo [setup] Creating Python virtual environment...
    python -m venv .venv
)

call .venv\Scripts\activate.bat

echo [setup] Installing / updating dependencies...
python -m pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt

if not exist ".env" (
    echo [setup] Creating .env from template...
    copy /y .env.example .env >nul
)

if not exist "database\worldcup.db" (
    echo [setup] Seeding database with sample data...
    python seed.py
)

echo.
echo [run] Starting API on http://0.0.0.0:8000
echo       Swagger docs:  http://localhost:8000/docs
echo       (Press CTRL+C to stop)
echo.
uvicorn app.main:app --host 0.0.0.0 --port 8000

endlocal
