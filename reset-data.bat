@echo off
chcp 65001 >nul

echo ================================================
echo   LumiSport - Reset Data Tool
echo ================================================
echo.
echo  This will DELETE all stored user data:
echo    - server\data\users.json
echo.
echo  This action CANNOT be undone!
echo.

set /p confirm="Are you sure? Type YES to confirm: "
if /i not "%confirm%"=="YES" (
    echo.
    echo  Cancelled. No data was deleted.
    echo.
    pause
    exit /b 0
)

echo.

set "TARGETDIR=%~dp0"

if exist "%TARGETDIR%server\data\users.json" (
    del "%TARGETDIR%server\data\users.json"
    echo  [OK] users.json deleted.
) else (
    echo  [SKIP] users.json not found.
)

echo.
echo ================================================
echo  Data reset complete.
echo  Next time the server starts, it will
echo  create fresh empty data files.
echo ================================================
echo.

pause
