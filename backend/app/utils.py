from typing import Optional


def build_prompt(
    memory: str,
    history,
    user_input: str,
    mode: str = "friendly tutor",
    image_context: Optional[str] = None,
) -> str:
    prompt = f"You are a {mode}. Help the user clearly.\n\n"

    if memory:
        prompt += f"User Info:\n{memory}\n"

    prompt += "\nConversation:\n"

    for msg, res in history:
        prompt += f"User: {msg}\nAssistant: {res}\n"

    if image_context and image_context.strip():
        ref = image_context.strip()
        prompt += (
            "\nThe user attached an image. Below is text extracted from it (OCR). "
            "Use this as the primary factual reference when answering their message; "
            "if the question is about what is shown in the image, ground your answer in this text. "
            "OCR can be imperfect—note uncertainty if something is ambiguous.\n\n"
            f"--- Image reference (OCR) ---\n{ref}\n--- End image reference ---\n"
        )

    prompt += f"User: {user_input}\nAssistant:"

    return prompt
