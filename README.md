# � Offline LLM with Reze Avatar

A full-stack application featuring an offline LLM with voice interaction, OCR capabilities, and an animated avatar interface. Everything runs locally on a single port with no internet required.

**Repository:** [YerupalleVamsi/offline-llm-reze](https://github.com/YerupalleVamsi/offline-llm-reze)

---

## ✨ Features

- 🤖 **Offline LLM Chat** - Run large language models locally
- 🎤 **Voice Input** - Speech-to-text using Whisper (offline)
- 🖼️ **OCR Support** - Extract text from images with EasyOCR
- 🧍 **Animated Avatar** - Interactive 3D avatar (Reze character)
- 🎨 **Modern UI** - React + Vite frontend
- 🔒 **Privacy First** - Everything runs on your machine, no external API calls
- ⚡ **Single Port** - No complex setup, runs entirely on port 8000

---

## 📋 Prerequisites

- **Python 3.10+** (for backend)
- **Node.js 16+** (for frontend)
- **FFmpeg** (required for audio processing)
- **Git**

### Install FFmpeg

**Windows:**
```bash
# Using Chocolatey
choco install ffmpeg

# Or using Scoop
scoop install ffmpeg
```

**macOS:**
```bash
brew install ffmpeg
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get install ffmpeg
```

---

## 🚀 Quick Start

### Option 1: Automated Setup (Recommended)

**Windows:**
```bash
# Just double-click this file in your project folder:
RUN_UNIFIED.bat
```

**Linux/macOS:**
```bash
bash run-unified.sh
```

This will:
1. ✅ Install all Python dependencies
2. ✅ Install Node.js packages
3. ✅ Build the frontend
4. ✅ Start the backend server

### Option 2: Manual Setup

**1. Clone and navigate to the project:**
```bash
git clone https://github.com/YerupalleVamsi/offline-llm-reze.git
cd offline-llm-reze
```

**2. Set up the backend:**
```bash
cd backend
pip install -r requirements.txt
cd ..
```

**3. Set up the frontend:**
```bash
cd frontend
npm install
npm run build
cd ..
```

**4. Run the server:**
```bash
# On Windows
python backend/app/main.py

# On Linux/macOS
python3 backend/app/main.py
```

---

## 🌐 Access the Application

Once the backend is running, open your browser and go to:

```
http://localhost:8000
```

You'll see:
- 💬 Chat interface
- 🎤 Microphone input for voice chat
- 📤 File upload for OCR
- 🧍 Animated avatar responding to your messages

---

## 📁 Project Structure

```
offline-llm-reze/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI server & routes
│   │   ├── db.py                # Database management
│   │   ├── memory.py            # Chat history
│   │   ├── utils.py             # Utility functions
│   │   ├── routes/
│   │   │   ├── chat.py          # Chat endpoint
│   │   │   ├── ocr_route.py     # OCR endpoint
│   │   │   └── speech_route.py  # Speech recognition
│   │   ├── services/
│   │   │   ├── llm.py           # LLM interface
│   │   │   ├── ocr.py           # OCR service
│   │   │   └── speech.py        # Speech service
│   │   └── schemas/
│   │       └── chat.py          # Pydantic models
│   ├── requirements.txt          # Python dependencies
│   └── data/                     # SQLite database
│
├── frontend/
│   ├── public/
│   │   └── avatar/              # Avatar assets
│   ├── src/
│   │   ├── components/
│   │   │   └── ChatBox.jsx      # Main chat ui
│   │   ├── pages/
│   │   │   └── Home.jsx         # Home page
│   │   ├── services/
│   │   │   └── api.js           # API calls
│   │   └── App.jsx              # Root component
│   ├── package.json
│   └── vite.config.js
│
├── avatar/                       # Avatar model files
│   ├── main.js
│   ├── index.html
│   └── reze__stylized_anime_girl.glb
│
└── README.md
```

---

## 🛠️ Technology Stack

### Backend
- **FastAPI** - Modern web framework
- **Uvicorn** - ASGI server
- **Whisper** - Speech-to-text
- **EasyOCR** - Optical character recognition
- **PyTorch** - Deep learning
- **Transformers** - LLM models
- **SQLite** - Database

### Frontend
- **React 19** - UI framework
- **Vite** - Build tool
- **CSS3** - Styling

### Avatar
- **three.js** or **Babylon.js** - 3D rendering
- **GLB format** - 3D model

---

## 🔧 Troubleshooting

### Port 8000 Already in Use
```bash
# Find what's using port 8000
# Windows:
netstat -ano | findstr :8000

# Linux/Mac:
lsof -i :8000

# Kill the process and restart
```

### Dependencies Not Installing
```bash
# Update pip
python -m pip install --upgrade pip

# Try installing with requirements again
pip install -r backend/requirements.txt
```

### Avatar Not Loading
- Ensure `public/avatar/` folder contains the `.glb` model file
- Check browser console for loading errors

### Whisper/Speech Not Working
- Verify FFmpeg is installed: `ffmpeg -version`
- Add FFmpeg to your system PATH

---

## 📚 API Endpoints

- **POST** `/api/chat` - Send a message and get LLM response
- **POST** `/api/ocr` - Upload image for text extraction
- **POST** `/api/speech` - Convert speech to text

---

## 📝 License

[Add your license here]

---

## 👨‍💻 Author

Created by: YerupalleVamsi

---

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest features
- Submit pull requests

---

**Enjoy your offline AI assistant! 🚀**

## 🔍 Verify Everything Works

| What to Check | URL |
|---|---|
| **Chat UI** | http://localhost:8000 |
| **Health Check** | http://localhost:8000/health |
| **API Docs** | http://localhost:8000/docs |

---

## 📚 Documentation

Choose what you need:

| File | For |
|------|-----|
| **QUICK_START.txt** | 30-second overview |
| **UNIFIED_SETUP.md** | Complete reference guide |
| **MANUAL_SETUP.txt** | Step-by-step instructions |
| **CHANGES_SUMMARY.md** | What changed and why |
| **CHECK_SETUP.bat** | Validate your environment |

---

## ⚡ Quick Troubleshooting

### "Backend not responding"
1. Make sure `RUN_UNIFIED.bat` is running (don't close it)
2. Check terminal for errors
3. Verify port 8000 is available

### "Failed to fetch audio"
Check that backend has `frontend/dist` folder. The script creates it automatically.

### "FFmpeg not found"
Audio won't work. Install from: https://ffmpeg.org/download.html

### "Port already in use"
Close other apps using port 8000, or edit batch file to use port 8001.

---

## 🎯 Key Files

```
ROOT/
├── RUN_UNIFIED.bat        ← CLICK THIS TO START
├── QUICK_START.txt        ← Read this first
├── UNIFIED_SETUP.md       ← Full documentation
├── CHANGES_SUMMARY.md     ← What changed
│
├── frontend/
│   ├── src/              ← React components
│   ├── dist/             ← Built files (created automatically)
│   ├── package.json
│   └── vite.config.js
│
└── backend/
    ├── app/main.py       ← Now serves frontend + API
    ├── requirements.txt
    └── app/routes/
```

---

## 💡 How It Works

```
Your Browser
    ↓
http://localhost:8000 (FastAPI Backend)
    ├─ GET / → Returns frontend UI (HTML/CSS/JS)
    ├─ GET /api/speech/process → Transcribe audio
    ├─ GET /api/chat → Chat endpoints  
    ├─ GET /docs → API documentation
    └─ GET /health → Server status
```

Single server, single port, everything in one place!

---

## 🆘 Still Having Issues?

1. **Read QUICK_START.txt** - Most common problems covered
2. **Check terminal logs** - Error messages show exactly what's wrong
3. **Open browser console** (F12 → Console) - Check for JavaScript errors
4. **Visit http://localhost:8000/health** - Confirms backend is running

---

## ✨ Next Steps

1. **Run:** `RUN_UNIFIED.bat`
2. **Wait:** First build takes 1-2 minutes
3. **Open:** `http://localhost:8000` in browser
4. **Test:** Record audio or upload a file
5. **Enjoy:** Everything should just work! 🎉

---

**Questions?** Check the documentation files - they have all the details!

---

## Old Setup vs New

**Before:**
```
Terminal 1: npm run dev (port 5173)
Terminal 2: uvicorn ... (port 8000)
Errors: "Failed to fetch", CORS issues
```

**Now:**
```
Single command: RUN_UNIFIED.bat (port 8000)
Everything works: No CORS, single port
```

Much simpler! 🚀
