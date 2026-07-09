@echo off
REM ============================================================================
REM  Prabhu Capital - World Cup Prediction League
REM  One-click SETUP + RUN for Windows (uses a local .venv)
REM
REM  HOW TO USE
REM    1. Place THIS file inside the "prabhu-worldcup-league" folder - the one
REM       that directly contains the "backend" and "frontend" folders.
REM    2. Double-click this file.
REM
REM  PYTHON / SSL NOTES
REM    pip needs a Python whose SSL works. This script prefers a clean
REM    python.org 3.12/3.11/3.10, verifies SSL in the base AND the venv, and
REM    for the common conda case (base has SSL, venv does not) it adds conda's
REM    library folders to PATH for this run so the venv can find OpenSSL.
REM
REM    If SSL still can't be made to work, the two guaranteed options are:
REM      A) Open "Anaconda Prompt" from the Start menu and run this file there.
REM      B) Install Python 3.12 from https://www.python.org/downloads/windows/
REM         (tick "Add python.exe to PATH"), delete backend\.venv, run again.
REM
REM  If a previous attempt half-finished, delete "backend\.venv" and
REM  "frontend\node_modules" and run this again for a clean install.
REM ============================================================================
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

REM --- internal modes: used to launch the two servers in their own windows ---
if /I "%~1"=="_backend"  goto run_backend
if /I "%~1"=="_frontend" goto run_frontend

REM --- OPTIONAL: force a specific Python. Example:
REM       set "FORCE_PY=C:\Python312\python.exe"
set "FORCE_PY="

title Prabhu League - Setup
color 0B
echo.
echo ============================================================
echo    Prabhu Capital  -  World Cup Prediction League
echo    Windows setup ^& run
echo ============================================================
echo.

if not exist "backend\app\main.py" (
  echo [ERROR] Could not find the "backend" folder next to this file.
  echo         Move this .bat into the prabhu-worldcup-league folder
  echo         ^(the one that contains "backend" and "frontend"^), then retry.
  goto fail
)

REM ------------------------------------------------------------------
REM  1) Find a Python that runs AND has a working SSL module
REM ------------------------------------------------------------------
set "PYCMD="
if defined FORCE_PY call :try_py "%FORCE_PY%"
if not defined PYCMD call :try_py "py -3.12"
if not defined PYCMD call :try_py "py -3.11"
if not defined PYCMD call :try_py "py -3.10"
if not defined PYCMD call :try_py "python"
if not defined PYCMD call :try_py "py -3"

if not defined PYCMD (
  echo.
  echo [ERROR] No Python with a working SSL module was found.
  echo   Install Python 3.12 from https://www.python.org/downloads/windows/
  echo   ^(tick "Add python.exe to PATH"^) and run this again, or open the
  echo   "Anaconda Prompt" and run this file from there.
  goto fail
)

for /f "delims=" %%v in ('%PYCMD% --version 2^>^&1') do set "PYVER=%%v"
echo [ok] Base Python: !PYVER!   ^(command: %PYCMD%^)  - SSL OK in base.
echo.

REM --- Figure out the base install folder (used to help the venv find SSL) ---
set "BASEPREFIX="
for /f "delims=" %%p in ('%PYCMD% -c "import sys;print(sys.base_prefix)" 2^>nul') do set "BASEPREFIX=%%p"

REM ------------------------------------------------------------------
REM  2) Backend virtual environment (.venv)
REM ------------------------------------------------------------------
cd /d "%~dp0backend"

if not exist ".venv\Scripts\python.exe" (
  echo [setup] Creating virtual environment:  backend\.venv
  %PYCMD% -m venv .venv
)
if not exist ".venv\Scripts\python.exe" (
  echo [ERROR] Failed to create the .venv virtual environment.
  echo         Ensure Python's "venv" module is available, then retry.
  goto fail
)
set "VPY=.venv\Scripts\python.exe"

REM --- Make sure SSL works inside the venv (repair the conda case) ---
"%VPY%" -c "import ssl" >nul 2>nul
if not errorlevel 1 goto venv_ssl_ok

REM Attempt 1: add the base install's library folders to PATH for this run.
if defined BASEPREFIX (
  echo [fix] Adding base Python library folders to PATH so the venv finds SSL...
  set "PATH=!BASEPREFIX!;!BASEPREFIX!\DLLs;!BASEPREFIX!\Library\bin;!BASEPREFIX!\Library\mingw-w64\bin;!BASEPREFIX!\Library\usr\bin;!BASEPREFIX!\Scripts;!PATH!"
)
"%VPY%" -c "import ssl" >nul 2>nul
if not errorlevel 1 (
  echo [ok] SSL now works inside the venv.
  goto venv_ssl_ok
)

REM Attempt 2: copy OpenSSL DLLs from likely locations into the venv folder.
if defined BASEPREFIX (
  echo [fix] Copying OpenSSL libraries into the venv as a fallback...
  copy /y "!BASEPREFIX!\Library\bin\libssl*.dll"     ".venv\Scripts\" >nul 2>nul
  copy /y "!BASEPREFIX!\Library\bin\libcrypto*.dll"  ".venv\Scripts\" >nul 2>nul
  copy /y "!BASEPREFIX!\libssl*.dll"                 ".venv\Scripts\" >nul 2>nul
  copy /y "!BASEPREFIX!\libcrypto*.dll"              ".venv\Scripts\" >nul 2>nul
  copy /y "!BASEPREFIX!\DLLs\libssl*.dll"            ".venv\Scripts\" >nul 2>nul
  copy /y "!BASEPREFIX!\DLLs\libcrypto*.dll"         ".venv\Scripts\" >nul 2>nul
)
"%VPY%" -c "import ssl" >nul 2>nul
if not errorlevel 1 (
  echo [ok] SSL now works inside the venv.
  goto venv_ssl_ok
)

echo.
echo [ERROR] Could not get a working SSL module inside the virtual environment.
echo         This happens with some conda Python builds. Please use ONE of:
echo.
echo   A) Open "Anaconda Prompt" from the Start menu, then run:
echo        cd /d "%~dp0"
echo        SETUP_AND_RUN.bat
echo      ^(conda is active there, so the venv can find SSL^).
echo.
echo   B) Install Python 3.12 from https://www.python.org/downloads/windows/
echo      ^(tick "Add python.exe to PATH"^), delete the backend\.venv folder,
echo      then run this file again.
goto fail

:venv_ssl_ok
echo [ok] SSL is working in the virtual environment.

echo [setup] Upgrading pip ...
"%VPY%" -m pip install --upgrade pip >nul 2>nul

echo [setup] Installing Python packages ^(first run can take a few minutes^) ...
"%VPY%" -m pip install -r requirements.txt
if errorlevel 1 (
  echo.
  echo [ERROR] Installing Python packages failed - scroll up for the reason.
  echo         Likely causes: no internet connection, a company proxy/firewall,
  echo         or a custom pip index in pip.ini that is unreachable.
  goto fail
)

if not exist ".env" (
  echo [setup] Creating backend\.env from template ...
  copy /y ".env.example" ".env" >nul
)

if not exist "database" mkdir "database"
if not exist "database\worldcup.db" (
  echo [setup] Initializing the database (admin account only) ...
  "%VPY%" seed.py
  if errorlevel 1 (
    echo [ERROR] Database seeding failed - scroll up for the reason.
    goto fail
  )
)
echo [ok] Backend ready.
echo.

REM ------------------------------------------------------------------
REM  3) Frontend (web app) packages
REM ------------------------------------------------------------------
cd /d "%~dp0frontend"

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js / npm was not found on this PC.
  echo         Install the LTS version from https://nodejs.org/ then retry.
  goto fail
)

if not exist "node_modules" (
  echo [setup] Installing web app packages ^(first run can take a few minutes^) ...
  call npm install
  if errorlevel 1 (
    echo [ERROR] "npm install" failed - scroll up for the reason.
    goto fail
  )
)

if not exist ".env" (
  echo [setup] Creating frontend\.env from template ...
  copy /y ".env.example" ".env" >nul
)
echo [ok] Web app ready.
echo.

REM ------------------------------------------------------------------
REM  4) Launch the two servers, each in its own window
REM     (they inherit the PATH we fixed above, so SSL keeps working)
REM ------------------------------------------------------------------
cd /d "%~dp0"
echo [run] Starting the API and the website in their own windows ...
start "Prabhu League - API (port 8000)"     cmd /k "%~dp0run-api.bat"
start "Prabhu League - Website (port 3000)" cmd /k "%~dp0run-web.bat"

echo [run] Waiting a few seconds for the servers to come up ...
timeout /t 8 /nobreak >nul
echo [run] Opening the app in your browser ...
start "" "http://localhost:3000"

echo.
echo ============================================================
echo   Everything is starting up.
echo.
echo   Open in your browser:     http://localhost:3000
echo   API / Swagger docs:       http://localhost:8000/docs
echo.
echo   Admin login:  admin@prabhucapital.com   /   Admin@123
echo   (Staff sign up themselves on the Register page.)
echo.
echo   Two new windows opened (the API and the website). Keep them
echo   open while using the app; close them to stop the servers.
echo.
echo   If the browser did not open, go to  http://localhost:3000
echo   To start again LATER without reinstalling, just double-click
echo   run-api.bat  and  run-web.bat  in this folder.
echo.
echo   To let OTHER office PCs connect, see docs\DEPLOYMENT.md.
echo ============================================================
echo.
echo You can close THIS window now.
pause >nul
exit /b 0

REM ==========================================================================
REM  Helper: test a Python command. %~1 = command (e.g. "py -3.12").
REM ==========================================================================
:try_py
%~1 --version >nul 2>nul
if errorlevel 1 goto :eof
%~1 -c "import ssl" >nul 2>nul
if errorlevel 1 (
  echo [skip] "%~1" was found but its SSL module is not working - skipping.
  goto :eof
)
set "PYCMD=%~1"
goto :eof

REM ==========================================================================
REM  Server runners - invoked in their own windows by the launcher above
REM ==========================================================================
:run_backend
title Prabhu League - API (port 8000)
cd /d "%~dp0backend"
echo Starting API on http://0.0.0.0:8000   (Swagger at /docs)
echo Press CTRL+C to stop.
echo.
".venv\Scripts\python.exe" -m uvicorn app.main:app --host 0.0.0.0 --port 8000
echo.
echo [API stopped] Press any key to close this window.
pause >nul
exit /b 0

:run_frontend
title Prabhu League - Website (port 3000)
cd /d "%~dp0frontend"
echo Starting website on http://0.0.0.0:3000
echo Press CTRL+C to stop.
echo.
call npm run dev
echo.
echo [Website stopped] Press any key to close this window.
pause >nul
exit /b 0

:fail
color 0C
echo.
echo Setup did not complete. Fix the issue shown above and run this file again.
echo.
pause
exit /b 1
