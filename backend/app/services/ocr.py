"""EasyOCR — lazy singleton; first use may download detection/recognition models."""

from __future__ import annotations

import io
import numpy as np

_reader = None


def _get_reader():
    global _reader
    if _reader is None:
        import easyocr

        _reader = easyocr.Reader(["en"], gpu=False)
    return _reader


def _decode_to_rgb_array(data: bytes) -> np.ndarray:
    """Decode common raster formats; OpenCV first, then Pillow (WebP, HEIF if plug-in, etc.)."""
    import cv2

    arr = np.frombuffer(data, dtype=np.uint8)
    bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if bgr is not None:
        return cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)

    try:
        from PIL import Image, UnidentifiedImageError

        pil = Image.open(io.BytesIO(data))
        pil = pil.convert("RGB")
        return np.array(pil, dtype=np.uint8)
    except UnidentifiedImageError as e:
        raise ValueError(
            "Could not read that file as an image (try PNG, JPEG, WebP, GIF, BMP, or TIFF)"
        ) from e
    except Exception as e:
        raise ValueError(f"Could not decode image: {e}") from e


def extract_text_from_bytes(data: bytes) -> str:
    img_rgb = _decode_to_rgb_array(data)
    reader = _get_reader()
    rows = reader.readtext(img_rgb)
    parts = [r[1] for r in rows if r[1]]
    return "\n".join(parts).strip()
