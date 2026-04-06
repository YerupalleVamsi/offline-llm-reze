import json
import os
from typing import Any, Generator
from urllib.parse import urlparse

import requests

DEFAULT_MODEL = os.environ.get("OLLAMA_MODEL", "mistral")
OLLAMA_GENERATE_URL = (
    os.environ.get("OLLAMA_GENERATE_URL", "").strip().rstrip("/")
    or f'{os.environ.get("OLLAMA_HOST", "http://localhost:11434").rstrip("/")}/api/generate'
)
_parsed_gen = urlparse(OLLAMA_GENERATE_URL)
OLLAMA_BASE = (
    f"{_parsed_gen.scheme}://{_parsed_gen.netloc}"
    if _parsed_gen.netloc
    else "http://localhost:11434"
)


def _num_ctx_default() -> int:
    raw = os.environ.get("OLLAMA_NUM_CTX", "4096").strip()
    try:
        return max(512, int(raw))
    except ValueError:
        return 4096


def _generate_payload(prompt: str, model: str, stream: bool) -> dict[str, Any]:
    """Options reduce VRAM spikes; override with OLLAMA_NUM_CTX."""
    return {
        "model": model,
        "prompt": prompt,
        "stream": stream,
        "options": {
            "num_ctx": _num_ctx_default(),
        },
    }


def _format_ollama_http_error(status_code: int, body: str) -> str:
    err = body[:800].strip() if body else "(empty body)"
    try:
        data = json.loads(body)
        if isinstance(data.get("error"), str):
            err = data["error"]
    except json.JSONDecodeError:
        pass

    lower = err.lower()
    if status_code >= 500 and (
        "runner" in lower or "terminated" in lower or "process has" in lower
    ):
        err += (
            " — The model process crashed (often out of VRAM/RAM, bad model file, or GPU driver). "
            "Try: pull the model again (`ollama pull "
            + DEFAULT_MODEL
            + "`), use a smaller model, set env `OLLAMA_NUM_CTX=2048`, or run Ollama CPU-only."
        )
    elif status_code == 500:
        err += " — Check `ollama ps` and server logs; ensure the model is pulled and fits in memory."

    return f"Ollama HTTP {status_code}: {err}"


def call_mistral(prompt: str, model: str = DEFAULT_MODEL, timeout: int = 120) -> str:
    try:
        response = requests.post(
            OLLAMA_GENERATE_URL,
            json=_generate_payload(prompt, model, False),
            timeout=timeout,
        )
    except requests.RequestException as e:
        raise RuntimeError(f"Ollama unreachable ({OLLAMA_BASE}): {e}") from e

    if not response.ok:
        raise RuntimeError(
            _format_ollama_http_error(response.status_code, response.text)
        )

    data = response.json()
    text = data.get("response")
    if text is None:
        raise RuntimeError(f"Unexpected Ollama response: {data!r}")
    return text


def stream_mistral(
    prompt: str, model: str = DEFAULT_MODEL, timeout: int = 120
) -> Generator[str, None, None]:
    """
    Yields text fragments as Ollama streams them (token-ish chunks).
    """
    try:
        r = requests.post(
            OLLAMA_GENERATE_URL,
            json=_generate_payload(prompt, model, True),
            stream=True,
            timeout=timeout,
        )
    except requests.RequestException as e:
        raise RuntimeError(f"Ollama unreachable ({OLLAMA_BASE}): {e}") from e

    if not r.ok:
        body = r.text[:1200] if r.text else ""
        raise RuntimeError(_format_ollama_http_error(r.status_code, body))

    try:
        for line in r.iter_lines(decode_unicode=True):
            if not line:
                continue
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
            except json.JSONDecodeError:
                continue
            if data.get("error"):
                raise RuntimeError(_format_ollama_http_error(500, json.dumps(data)))
            piece = data.get("response") or ""
            if piece:
                yield piece
            if data.get("done"):
                break
    finally:
        r.close()
