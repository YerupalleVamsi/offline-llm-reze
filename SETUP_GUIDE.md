# Audio Processing Setup Guide

## Quick Start (Windows)

### Option 1: Run Everything at Once
```bash
RUN_ALL.bat
```
This opens two command windows - one for backend, one for frontend.

### Option 2: Run Separately
Terminal 1 (Backend):
```bash
START_BACKEND.bat
```

Terminal 2 (Frontend):
```bash
START_FRONTEND.bat
```

---

## What Each Component Does

### Backend (FastAPI on port 8000)
- `/health` - Check if backend is running
- `/speech/process` - Convert audio to text (Whisper + mT5)
- `/chat` - Chat endpoints (LLM integration)
- `/ocr` - Image text extraction
- `/docs` - API documentation (Swagger UI)

### Frontend (Vite on port 5173)
- UI for recording/uploading audio
- Displays transcribed text
- Integrates with LLM responses
- Avatar animations

---

## Troubleshooting "Failed to Fetch"

### Step 1: Check Backend is Running
Open browser: `http://127.0.0.1:8000/health`

**If it works:**
```json
{
  "status": "ok",
  "message": "Backend is running and accessible"
}
```

**If it fails:** Backend is NOT running. Close all windows and use `RUN_ALL.bat`

### Step 2: Check Frontend Can See Backend
Open browser DevTools (F12):
- Go to Console tab
- Record/upload audio
- Look for network requests in Network tab
- Find `/api/speech/process` request
- Check Status (should be 200-299) and Response

### Step 3: Check Backend Logs
In the backend window, you should see:
```
INFO - Processing speech: filename=audio.wav, size=45000, lang=hi
INFO - Starting transcription for audio.wav in language hi
INFO - Transcription successful: {...}
```

If you see errors, that's the actual problem. Common errors:

#### "Could not decode audio"
- **Fix:** Install FFmpeg
  ```bash
  choco install ffmpeg  # If you have Chocolatey
  ```
  Or download from: https://ffmpeg.org/download.html
  Add FFmpeg to PATH

#### "No module named 'whisper'" or "No module named 'transformers'"
- **Fix:** Install dependencies
  ```bash
  cd backend
  pip install -r requirements.txt
  ```

#### CUDA/GPU errors
- **Not critical** - will use CPU (slower but works)
- Check backend logs for confirmation

### Step 4: Check Frontend API Configuration
If frontend can't reach backend, edit `frontend/.env.local` (create if needed):
```
VITE_DEV_API_DIRECT=1
VITE_API_URL=http://127.0.0.1:8000
```

Then restart frontend: `npm run dev`

---

## Direct Testing (No Frontend Needed)

### Test speech processing with curl:

**PowerShell:**
```powershell
$file = "your_audio.wav"
$langCode = "hi"
curl -X POST "http://127.0.0.1:8000/speech/process" `
  -F "file=@$file" `
  -F "lang_code=$langCode"
```

**Command Prompt:**
```cmd
curl -X POST "http://127.0.0.1:8000/speech/process" -F "file=@audio.wav" -F "lang_code=hi"
```

Expected response:
```json
{
  "original_text": "नमस्ते",
  "english_text": "Hello",
  "source_lang": "Hindi",
  "lang_code": "hi"
}
```

---

## Manual Setup (If Scripts Don't Work)

### Backend
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend (in another terminal)
```bash
cd frontend
npm install
npm run dev
```

---

## System Requirements

- **Python 3.10+**
- **Node.js 16+**
- **FFmpeg** (for audio decoding)
- **RAM:** 8GB+ (models load into memory)
- **GPU:** Optional (CUDA for faster processing)

---

## Common Issues

| Error | Solution |
|-------|----------|
| Port 8000 already in use | Change port: `uvicorn app.main:app --port 8001` |
| CORS errors | Backend CORS is configured, shouldn't happen |
| Microphone not found | Check browser permissions (Settings → Privacy) |
| Audio file too large | Max 32MB, reduce file size |
| "ffmpeg not found" | Install FFmpeg and add to PATH |
| Very slow processing | GPU not detected, using CPU (normal, but slower) |

---

## What Happens When You Send Audio

1. **Browser Records/Uploads Audio**
   - Sends to `POST /api/speech/process`
   - Includes language code (hi, en, te, etc.)

2. **Backend Processes Audio**
   - Saves to temp file (WebM/WAV/MP3/etc.)
   - Uses Whisper (OpenAI) to transcribe
   - Translates to English using mT5

3. **Response Returned**
   - Original text in the language
   - English translation
   - Language name & code

4. **Frontend Uses Text**
   - Displayed in chat
   - Sent to LLM for response
   - Avatar speaks the response

---

If issues persist, check the backend console logs for the exact error message!
