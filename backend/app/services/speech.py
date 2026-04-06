"""
Offline speech: Whisper STT + mT5 translate to English.
Models load lazily on first use to keep API startup fast.
"""

from __future__ import annotations

import os
import tempfile
import threading
from typing import Any

WHISPER_MODEL_SIZE = "base"
MT5_MODEL_NAME = "google/mt5-small"
SAMPLE_RATE = 16000

LANG_MAP: dict[str, str] = {
    "hi": "Hindi",
    "te": "Telugu",
    "ta": "Tamil",
    "kn": "Kannada",
    "ml": "Malayalam",
    "bn": "Bengali",
    "mr": "Marathi",
    "gu": "Gujarati",
    "pa": "Punjabi",
    "ur": "Urdu",
    "or": "Odia",
    "en": "English",
}

_lock = threading.Lock()
_whisper_model: Any = None
_mt5_tokenizer: Any = None
_mt5_model: Any = None
_device: str | None = None


def _get_device() -> str:
    global _device
    if _device is None:
        import torch

        _device = "cuda" if torch.cuda.is_available() else "cpu"
    return _device


def _load_whisper():
    global _whisper_model
    if _whisper_model is not None:
        return _whisper_model
    import whisper
    import torch

    with _lock:
        if _whisper_model is None:
            dev = _get_device()
            _whisper_model = whisper.load_model(WHISPER_MODEL_SIZE, device=dev)
    return _whisper_model


def _load_mt5():
    global _mt5_tokenizer, _mt5_model
    if _mt5_tokenizer is not None and _mt5_model is not None:
        return _mt5_tokenizer, _mt5_model
    import torch
    from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

    with _lock:
        if _mt5_tokenizer is None:
            _mt5_tokenizer = AutoTokenizer.from_pretrained(MT5_MODEL_NAME)
            _mt5_model = AutoModelForSeq2SeqLM.from_pretrained(MT5_MODEL_NAME).to(
                _get_device()
            )
    return _mt5_tokenizer, _mt5_model


def _transcribe_file(path: str, lang_code: str) -> str:
    model = _load_whisper()
    device = _get_device()
    lang_name = LANG_MAP.get(lang_code, lang_code)
    result = model.transcribe(
        path,
        task="transcribe",
        language=lang_code if lang_code != "en" else "en",
        initial_prompt=f"This is {lang_name} speech",
        fp16=(device == "cuda"),
        temperature=0,
    )
    return (result.get("text") or "").strip()


def _to_english(text: str) -> str:
    tokenizer, model = _load_mt5()
    import torch

    input_text = f"translate to English: {text}"
    inputs = tokenizer(
        input_text,
        return_tensors="pt",
        padding=True,
        truncation=True,
    )
    dev = _get_device()
    inputs = {k: v.to(dev) for k, v in inputs.items()}
    with torch.no_grad():
        outputs = model.generate(**inputs, max_length=256)
    return tokenizer.decode(outputs[0], skip_special_tokens=True)


def normalize_lang_code(lang_code: str) -> str:
    code = (lang_code or "hi").strip().lower()
    if code in LANG_MAP:
        return code
    return "hi"


def process_audio_file(path: str, lang_code: str) -> dict[str, Any]:
    lang = normalize_lang_code(lang_code)
    try:
        text = _transcribe_file(path, lang)
    except FileNotFoundError as e:
        raise ValueError(
            "Audio file not found. FFmpeg may not be installed. Install it from: https://ffmpeg.org/download.html"
        ) from e
    except RuntimeError as e:
        if "ffmpeg" in str(e).lower():
            raise ValueError(
                "FFmpeg not found. Install from: https://ffmpeg.org/download.html (required for audio processing)"
            ) from e
        raise ValueError(
            f"Could not decode audio: {e}. Ensure FFmpeg is installed and on PATH."
        ) from e
    except Exception as e:
        raise ValueError(
            f"Speech transcription failed: {e}. Install FFmpeg for audio support: https://ffmpeg.org/download.html"
        ) from e

    if not text or not text.strip():
        return {"error": "No speech detected in audio. Please try again with clearer audio."}

    if lang == "en":
        english = text
    else:
        english = _to_english(text)

    return {
        "original_text": text,
        "english_text": english,
        "source_lang": LANG_MAP.get(lang, lang),
        "lang_code": lang,
    }


def process_uploaded_audio(data: bytes, filename: str | None, lang_code: str) -> dict[str, Any]:
    if not data:
        return {"error": "Empty file"}

    suffix = os.path.splitext(filename or "")[1].lower()
    if not suffix or suffix not in (
        ".wav",
        ".flac",
        ".ogg",
        ".webm",
        ".mp3",
        ".m4a",
        ".mp4",
        ".opus",
    ):
        suffix = ".webm"

    fd, path = tempfile.mkstemp(suffix=suffix)
    try:
        os.write(fd, data)
        os.close(fd)
        fd = -1
        # Process the file - file is kept alive during processing
        result = process_audio_file(path, lang_code)
        return result
    finally:
        if fd >= 0:
            try:
                os.close(fd)
            except OSError:
                pass
        # Clean up temp file after processing is complete
        try:
            if os.path.exists(path):
                os.unlink(path)
        except OSError:
            pass


def supported_languages() -> dict[str, str]:
    return dict(LANG_MAP)
