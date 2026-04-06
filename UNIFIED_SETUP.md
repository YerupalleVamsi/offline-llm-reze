# Single Port Setup (Production-Ready)

## What This Does

Builds the frontend and serves it from the backend on a **single port (8000)**.

- **Frontend UI:** `http://localhost:8000`
- **API Endpoints:** `http://localhost:8000/api/*`
- **API Docs:** `http://localhost:8000/docs`
- **No CORS issues** ✅
- **No port conflicts** ✅
- **Production-ready** ✅

---

## Quick Start

### Windows
```bash
RUN_UNIFIED.bat
```

### Linux/Mac
```bash
bash run-unified.sh
```

Both commands will:
1. Install frontend dependencies
2. Build the frontend (creates `frontend/dist`)
3. Start the backend on port 8000
4. Serve both frontend + API together

---

## What Happens Behind the Scenes

1. **Frontend Build**
   ```bash
   cd frontend
   npm install
   npm run build   # Creates dist/ folder with optimized HTML/JS/CSS
   cd ..
   ```

2. **Backend Serves Everything**
   - FastAPI mounts the `frontend/dist` folder as static files
   - Routes starting with `/api` go to API endpoints
   - All other routes serve `index.html` (for SPA routing)
   - Everything runs on `http://127.0.0.1:8000`

---

## File Structure After Build

```
frontend/
  dist/                 # Built files (created by npm run build)
    index.html
    assets/
    ...
  src/
  package.json
  vite.config.js

backend/
  app/
    main.py           # Now serves frontend/dist as static files
    routes/
    services/
  requirements.txt
```

---

## Port Verification

Make sure port 8000 is free:

**Windows (PowerShell):**
```powershell
netstat -ano | findstr :8000
# If you see something, kill it:
Get-Process -Id (Get-NetTCPConnection -LocalPort 8000).OwningProcess | Stop-Process
```

**Linux/Mac:**
```bash
lsof -i :8000
# Kill if needed: kill -9 <PID>
```

---

## Development Workflow

### Option 1: Single Port (Recommended)
This is what `RUN_UNIFIED.bat` does. Best for production-like testing.

```bash
npm run build    # Frontend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000  # Backend serves all
```

### Option 2: Separate Ports (Development Only)

Terminal 1 (Backend on 8000):
```bash
cd backend
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Terminal 2 (Frontend on 5173):
```bash
cd frontend
VITE_API_URL=http://127.0.0.1:8000 npm run dev  # Tell frontend where backend is
```

Then open: `http://localhost:5173`

---

## Troubleshooting

### "Build failed"
Check Node.js version:
```bash
node --version   # Should be 16+
npm --version    # Should be 8+
```

### "Port 8000 already in use"
Kill the process using port 8000 (see Port Verification above) or use a different port:
```bash
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

### "frontend/dist not found"
The build failed. Check for errors in the output and make sure `npm install` succeeded.

### "Failed to fetch from /api/*"
- Check backend is running: `http://localhost:8000/health`
- Check browser console (F12) for exact error
- Check backend logs for error details

### "FFmpeg not found"
Audio processing won't work. Install FFmpeg:
- **Windows:** Download from https://ffmpeg.org/download.html and add to PATH
- **Mac:** `brew install ffmpeg`
- **Linux:** `apt-get install ffmpeg` or `yum install ffmpeg`

---

## Testing the Setup

### 1. Frontend is Serving
```bash
curl http://localhost:8000
# Should return HTML content
```

### 2. API is Working
```bash
curl http://localhost:8000/health
# Should return: {"status":"ok","message":"..."}
```

### 3. Speech Processing
Open `http://localhost:8000` in browser → Record audio → Should transcribe

---

## Building for Production (Advanced)

If you want to deploy to a server:

```bash
# On your machine
npm run build
# Commit frontend/dist to git (or copy to server)

# On server
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Then access via your server's IP: `http://<server-ip>:8000`

---

## Common Issues & Quick Fixes

| Problem | Solution |
|---------|----------|
| "Failed to fetch" | Check `http://localhost:8000/health` - if it fails, backend not running |
| Audio not working | Install FFmpeg |
| "Module not found" | Run `pip install -r requirements.txt` in backend folder |
| Frontend looks broken | Run `npm run build` in frontend folder |
| Port already in use | Change port in command: `--port 8001` |

---

## Important Files

- `backend/app/main.py` - Serves static files + API
- `frontend/dist/` - Built frontend (created by `npm run build`)
- `RUN_UNIFIED.bat` - One-click start for Windows
- `run-unified.sh` - One-click start for Linux/Mac
