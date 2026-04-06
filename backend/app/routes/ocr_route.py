from fastapi import APIRouter, File, HTTPException, UploadFile

from app.services.ocr import extract_text_from_bytes

router = APIRouter(tags=["ocr"])


@router.post("/ocr")
async def ocr_image(file: UploadFile = File(...)):
    # Do not rely on Content-Type (browsers/OS often send octet-stream or wrong types).
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(data) > 15 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image too large (max 15MB)")
    try:
        text = extract_text_from_bytes(data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR failed: {e}") from e
    return {"text": text}
