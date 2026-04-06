@echo off
REM One-click startup for unified single-port setup
REM Builds frontend and starts backend on port 8000 only

echo ============================================
echo Building Frontend...
echo ============================================
cd frontend
call npm install --legacy-peer-deps
if %ERRORLEVEL% NEQ 0 (
    echo Frontend build failed
    pause
    exit /b 1
)

call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo Frontend build failed
    pause
    exit /b 1
)

cd ..

echo.
echo ============================================
echo Starting Backend (everything on port 8000)
echo ============================================
echo.
echo Frontend UI: http://localhost:8000
echo API Docs:    http://localhost:8000/docs
echo Health:     http://localhost:8000/health
echo.

cd backend
python -m pip install -q -r requirements.txt

REM Check if ffmpeg is installed (required for audio processing)
where ffmpeg >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo WARNING: FFmpeg not found on PATH
    echo Audio processing will fail without FFmpeg
    echo Install from: https://ffmpeg.org/download.html
    echo.
)

python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
pause
