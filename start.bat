@echo off
chcp 65001 >nul

echo ================================================
echo   LumiSport Magic Hockey - Start Server
echo ================================================
echo.

set "TARGETDIR=%~dp0"
cd /d "%TARGETDIR%"

:: ---- Check Node.js ----
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo [ERROR] Please install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: ---- Check frontend dependencies ----
if not exist "node_modules\" (
    echo [INFO] Frontend node_modules not found, installing...
    echo.
    npm install
    if %ERRORLEVEL% neq 0 (
        echo.
        echo [ERROR] npm install failed!
        pause
        exit /b 1
    )
    echo.
    echo [OK] Frontend dependencies installed.
    echo.
)

:: ---- Check server dependencies ----
if not exist "server\node_modules\" (
    echo [INFO] Server node_modules not found, installing...
    echo.
    cd server
    npm install
    if %ERRORLEVEL% neq 0 (
        echo.
        echo [ERROR] Server npm install failed!
        pause
        exit /b 1
    )
    cd ..
    echo.
    echo [OK] Server dependencies installed.
    echo.
)

:: ---- Get LAN IP ----
set "IP=unknown"
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4" ^| findstr /v "127.0.0.1"') do (
    set IP=%%a
    goto :found
)
:found
set IP=%IP: =%

:: ---- Start backend server ----
title LumiSport - Backend + Frontend
echo [INFO] Starting backend server (port 3001)...
start "Backend Server" cmd /k "cd /d "%TARGETDIR%server" && node index.js"

:: Wait for backend to start
timeout /t 3 /nobreak >nul

:: ---- Start frontend dev server ----
echo [INFO] Starting Vite dev server (LAN enabled)...
start "Vite Server" cmd /k "cd /d "%TARGETDIR%" && npm run dev -- --host"

:: Wait for frontend to start
echo Waiting for servers to start...
timeout /t 5 /nobreak >nul

:: ---- Open browser ----
start http://localhost:5173/

:: ---- Display info ----
echo.
echo ================================================
echo  [OK] Both servers are running!
echo.
echo  Frontend:  http://localhost:5173/
echo  Backend:   http://localhost:3001/
echo  LAN:       http://%IP%:5173/
echo  Mobile:    http://%IP%:5173/mobile
echo.
echo  Share the Mobile URL with phones
echo  (must be on the same WiFi / LAN)
echo.
echo  Do NOT close the server windows
echo  Press Ctrl+C in those windows to stop
echo ================================================
echo.

pause
