@echo off
REM Start both backend and frontend in separate windows
echo Starting backend and frontend...
start "Backend Server" cmd /k "cd backend && python -m pip install -q -r requirements.txt && python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"
timeout /t 3 /nobreak
start "Frontend Dev Server" cmd /k "cd frontend && npm install && npm run dev"
echo.
echo Both servers are starting in separate windows
echo Backend: http://127.0.0.1:8000 (docs at /docs)
echo Frontend: http://localhost:5173
echo Health check: http://127.0.0.1:8000/health
pause
