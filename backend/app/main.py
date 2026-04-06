from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import logging
import os
from pathlib import Path

from app.db import init_db
from app.routes import chat, ocr_route, speech_route

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Chat API")

# allow_credentials=True with allow_origins=["*"] is invalid per CORS and can break cross-origin
# requests from the browser (e.g. dev UI on localhost calling API on 127.0.0.1).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    """Quick health check endpoint to verify backend is running."""
    return {
        "status": "ok",
        "message": "Backend is running and accessible",
    }


@app.on_event("startup")
def _startup() -> None:
    logger.info("Starting up...")
    init_db()
    logger.info("Database initialized")


app.include_router(chat.router)
app.include_router(ocr_route.router)
app.include_router(speech_route.router)
# Mirror under /api for proxies and clients that expect a prefixed API root
app.include_router(chat.router, prefix="/api")
app.include_router(ocr_route.router, prefix="/api")
app.include_router(speech_route.router, prefix="/api")

# Mount static files from frontend build
frontend_dist = Path(__file__).parent.parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    logger.info(f"Mounting static files from {frontend_dist}")
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="static")
else:
    logger.warning(f"Frontend dist folder not found at {frontend_dist}")
    logger.info("To build frontend: cd frontend && npm run build")

    # Fallback: serve index.html for SPA routing
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve SPA - in dev, frontend is served separately"""
        return {
            "error": "Frontend not built",
            "message": "Run 'cd frontend && npm run build' to generate dist folder",
            "api_docs": "Available at /docs"
        }
