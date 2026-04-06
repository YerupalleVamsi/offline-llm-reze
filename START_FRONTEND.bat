@echo off
REM Start the frontend React dev server
echo Starting Frontend Dev Server...
echo Will open at http://localhost:5173
echo.
cd frontend
if not exist node_modules (
    echo Installing dependencies...
    call npm install
)
call npm run dev
pause
