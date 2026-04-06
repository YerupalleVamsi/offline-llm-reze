import re
from typing import Optional, Tuple

MemoryPair = Tuple[str, str]


def _clean_fragment(s: str, max_len: int = 500) -> str:
    s = " ".join(s.split())
    return s[:max_len].strip()


def extract_memory(text: str) -> Optional[MemoryPair]:
    if not text or not text.strip():
        return None

    t = text.strip()
    lower = t.lower()

    m = re.search(
        r"my\s+name\s+(?:is|['’]s)\s+(.+?)(?:[.!?]|$)",
        lower,
        re.IGNORECASE | re.DOTALL,
    )
    if m:
        name = _clean_fragment(m.group(1), 120)
        name = re.sub(r"^[\"']|[\"']$", "", name)
        if name:
            return ("name", name)

    if "i like" in lower:
        return ("preference", _clean_fragment(t))

    if "exam" in lower:
        return ("context", _clean_fragment(t))

    return None
