@echo off
REM Start the backend FastAPI server
echo Starting Backend Server...
echo Listening on http://127.0.0.1:8000
echo API Docs at http://127.0.0.1:8000/docs
echo Health check at http://127.0.0.1:8000/health
echo.
cd backend
python -m pip install -q -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
pause
