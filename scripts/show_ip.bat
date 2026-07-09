@echo off
REM Print the machine's LAN IPv4 so colleagues can reach the app.
echo Share these addresses on your office network:
echo.
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    set "ip=%%a"
    setlocal enabledelayedexpansion
    set "ip=!ip: =!"
    echo    Web app : http://!ip!:3000
    echo    API     : http://!ip!:8000
    endlocal
)
echo.
echo (If several are listed, use the 192.168.x.x or 10.x.x.x one.)
echo IMPORTANT: also set VITE_API_URL in frontend\.env to the API
echo address above, then restart the frontend, so other PCs can log in.
