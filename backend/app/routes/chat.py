import json

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.db import get_memory, get_recent_history, save_conversation, save_memory
from app.memory import extract_memory
from app.schemas.chat import ChatRequest
from app.services.llm import call_mistral, stream_mistral
from app.utils import build_prompt

router = APIRouter()


def _prompt_and_history_user_message(req: ChatRequest) -> tuple[str, str]:
    history = get_recent_history(req.user_id, limit=req.history_limit)
    memory = get_memory(req.user_id)
    raw = req.message.strip()
    ctx = (req.image_context or "").strip() or None
    if not raw and not ctx:
        raise HTTPException(
            status_code=400,
            detail="Provide a message and/or image context (OCR text)",
        )
    history_user = raw if raw else "[Shared image text as context]"
    prompt_user = raw if raw else (
        "The user only attached an image with the above OCR text. Help them based on that."
    )
    prompt = build_prompt(memory, history, prompt_user, req.mode, ctx)
    return prompt, history_user


def _persist_turn(user_id: int, user_message: str, assistant_text: str) -> None:
    save_conversation(user_id, user_message, assistant_text)
    mem = extract_memory(user_message)
    if mem:
        save_memory(user_id, mem[0], mem[1])


@router.post("/chat")
def chat(req: ChatRequest):
    prompt, history_user = _prompt_and_history_user_message(req)
    try:
        response = call_mistral(prompt)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e

    _persist_turn(req.user_id, history_user, response)
    return {"response": response}


@router.post("/chat/stream")
def chat_stream(req: ChatRequest):
    """
    Server-Sent Events: `data: {"token":"..."}\\n\\n`, then `data: [DONE]\\n\\n`
    after the full reply is saved. If the client disconnects early, nothing is saved.
    """
    prompt, history_user = _prompt_and_history_user_message(req)

    def event_gen():
        parts: list[str] = []
        try:
            for chunk in stream_mistral(prompt):
                parts.append(chunk)
                yield f"data: {json.dumps({'token': chunk})}\n\n"
        except GeneratorExit:
            raise
        except RuntimeError as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
            return
        else:
            full = "".join(parts)
            _persist_turn(req.user_id, history_user, full)
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
