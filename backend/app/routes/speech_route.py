from fastapi import APIRouter, File, Form, HTTPException, UploadFile
import logging

from app.services import speech as speech_service

logger = logging.getLogger(__name__)
router = APIRouter(tags=["speech"])

MAX_AUDIO_BYTES = 32 * 1024 * 1024


@router.get("/speech/languages")
def list_speech_languages():
    return {"languages": speech_service.supported_languages()}


@router.post("/speech/process")
async def process_speech(
    file: UploadFile = File(...),
    lang_code: str = Form("hi"),
):
    logger.info(f"Processing speech: filename={file.filename}, size={file.size}, lang={lang_code}")
    
    data = await file.read()
    if not data:
        logger.warning("Empty audio file received")
        raise HTTPException(status_code=400, detail="Empty file")
    if len(data) > MAX_AUDIO_BYTES:
        logger.warning(f"Audio file too large: {len(data)} bytes (max {MAX_AUDIO_BYTES})")
        raise HTTPException(status_code=413, detail="Audio too large (max 32MB)")

    lang = speech_service.normalize_lang_code(lang_code)
    name = file.filename or "upload"

    try:
        logger.info(f"Starting transcription for {name} in language {lang}")
        result = speech_service.process_uploaded_audio(data, name, lang)
        logger.info(f"Transcription successful: {result}")
    except ValueError as e:
        logger.error(f"Validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.error(f"Unexpected error during speech processing: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Speech processing failed: {e}",
        ) from e

    if result.get("error"):
        logger.warning(f"Processing returned error: {result['error']}")
        raise HTTPException(status_code=422, detail=result["error"])

    logger.info(f"Speech processing completed successfully for {name}")
    return result
