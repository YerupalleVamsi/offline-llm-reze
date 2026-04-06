@echo off
REM Quick validation that everything is set up correctly

echo Checking prerequisites...
echo.

echo [1/5] Checking Python...
python --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Python not found. Install from https://python.org/
    exit /b 1
)
for /f "tokens=2" %%i in ('python --version 2^>^&1') do set PYTHON_VER=%%i
echo ✓ Python %PYTHON_VER% found

echo.
echo [2/5] Checking Node.js...
node --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js not found. Install from https://nodejs.org/
    exit /b 1
)
for /f %%i in ('node --version') do set NODE_VER=%%i
echo ✓ Node.js %NODE_VER% found

echo.
echo [3/5] Checking npm...
npm --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ npm not found
    exit /b 1
)
for /f %%i in ('npm --version') do set NPM_VER=%%i
echo ✓ npm %NPM_VER% found

echo.
echo [4/5] Checking FFmpeg...
where ffmpeg >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ⚠ FFmpeg not found (audio processing won't work)
    echo Install from: https://ffmpeg.org/download.html
) else (
    for /f "tokens=*" %%i in ('ffmpeg -version 2^>^&1 ^| findstr version') do set FFMPEG_VER=%%i
    echo ✓ FFmpeg found
)

echo.
echo [5/5] Checking backend requirements...
cd backend
python -m pip list | findstr fastapi >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ⚠ Backend dependencies not installed
    echo Run: pip install -r requirements.txt
) else (
    echo ✓ FastAPI installed
)
cd ..

echo.
echo ============================================
echo Setup Validation Complete!
echo ============================================
echo.
echo ✓ You can now run: RUN_UNIFIED.bat
echo.
pause
