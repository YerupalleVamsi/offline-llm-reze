#!/bin/bash
# Single-port unified startup for Linux/Mac

echo "============================================"
echo "Building Frontend..."
echo "============================================"
cd frontend
npm install --legacy-peer-deps || exit 1
npm run build || exit 1
cd ..

echo ""
echo "============================================"
echo "Starting Backend (everything on port 8000)"
echo "============================================"
echo ""
echo "Frontend UI: http://localhost:8000"
echo "API Docs:    http://localhost:8000/docs"
echo "Health:     http://localhost:8000/health"
echo ""

cd backend
python -m pip install -q -r requirements.txt

# Check if ffmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
    echo ""
    echo "WARNING: FFmpeg not found"
    echo "Audio processing will fail without FFmpeg"
    echo "Install: brew install ffmpeg (Mac) or apt-get install ffmpeg (Linux)"
    echo ""
fi

python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
