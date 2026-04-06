from typing import Optional

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    user_id: int = Field(..., description="Stable id per user/session for memory + history")
    message: str
    image_context: Optional[str] = Field(
        default=None,
        description="OCR or other text from an image, included in the prompt as context",
    )
    mode: str = "friendly tutor"
    history_limit: int = Field(
        default=10,
        ge=1,
        le=50,
        description="How many past turns to include in the prompt",
    )
