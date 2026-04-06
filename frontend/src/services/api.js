/**
 * Base URL for the FastAPI backend (no trailing slash).
 * - When frontend is served from backend: use relative paths (/api/...)
 * - For development with separate port: VITE_API_URL env var
 */
function apiBase() {
  // Check if custom API URL is set
  const env = import.meta.env.VITE_API_URL?.trim();
  if (env) {
    return env.replace(/\/$/, "");
  }

  // Development: use relative path (backend serves frontend on same port)
  if (import.meta.env.DEV) {
    return "/api";
  }

  // Production: use same-origin API
  return "/api";
}

function apiUrl(path) {
  const base = apiBase();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

const USER_ID_KEY = "chat_user_id";

function getUserId() {
  let id = localStorage.getItem(USER_ID_KEY);
  if (!id) {
    const legacy = localStorage.getItem("shittytest_user_id");
    if (legacy) {
      localStorage.setItem(USER_ID_KEY, legacy);
      id = legacy;
    }
  }
  if (!id) {
    id = String(Math.floor(Math.random() * 900_000_000) + 100_000_000);
    localStorage.setItem(USER_ID_KEY, id);
  }
  const n = parseInt(id, 10);
  return Number.isFinite(n) ? n : 1;
}

function chatBody(message, options) {
  const body = {
    user_id: options.userId ?? getUserId(),
    message: (message || "").trim(),
    mode: options.mode ?? "friendly tutor",
    history_limit: options.historyLimit ?? 10,
  };
  const ic = options.imageContext?.trim();
  if (ic) body.image_context = ic;
  return body;
}

/**
 * Run EasyOCR on an image; returns extracted text.
 */
/**
 * Whisper + mT5: transcribe audio and translate to English (server-side).
 * @param {File|Blob} file
 * @param {string} langCode Whisper language code (e.g. hi, en)
 */
export async function processSpeechAudio(file, langCode = "hi") {
  const fd = new FormData();
  const name =
    file instanceof File ? file.name || "audio"
    : `recording.${file.type?.includes("webm") ? "webm" : "ogg"}`;
  fd.append("file", file, name);
  fd.append("lang_code", (langCode || "hi").trim().toLowerCase());
  const res = await fetch(apiUrl("/speech/process"), {
    method: "POST",
    body: fd,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const err = await res.json();
      if (typeof err.detail === "string") detail = err.detail;
      else if (Array.isArray(err.detail))
        detail = err.detail.map((e) => e.msg || e).join("; ");
      else if (err.detail) detail = JSON.stringify(err.detail);
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.json();
}

export async function ocrImage(file) {
  const fd = new FormData();
  fd.append("file", file, file.name || "upload");
  const res = await fetch(apiUrl("/ocr"), {
    method: "POST",
    body: fd,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const err = await res.json();
      if (typeof err.detail === "string") detail = err.detail;
      else if (Array.isArray(err.detail))
        detail = err.detail.map((e) => e.msg || e).join("; ");
      else if (err.detail) detail = JSON.stringify(err.detail);
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.json();
}

/** Non-streaming JSON (avatar / simple clients). */
export async function sendPrompt(message, options = {}) {
  const res = await fetch(apiUrl("/chat"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(chatBody(message, options)),
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const err = await res.json();
      if (typeof err.detail === "string") detail = err.detail;
      else if (Array.isArray(err.detail))
        detail = err.detail.map((e) => e.msg || e).join("; ");
      else if (err.detail) detail = JSON.stringify(err.detail);
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }

  return res.json();
}

function isAbortError(e) {
  return (
    e &&
    (e.name === "AbortError" ||
      (typeof DOMException !== "undefined" &&
        e instanceof DOMException &&
        e.name === "AbortError"))
  );
}

/**
 * Streaming chat. Pass `options.signal` (AbortController) to stop.
 * Handlers: onToken, onDone(full), onStop(partial) when user aborts, onError(err).
 */
export async function sendPromptStream(message, options = {}, handlers) {
  const { onToken, onDone, onStop, onError } = handlers;
  const signal = options.signal;

  let res;
  try {
    res = await fetch(apiUrl("/chat/stream"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(chatBody(message, options)),
      signal,
    });
  } catch (e) {
    if (isAbortError(e)) {
      onStop?.("");
      return;
    }
    onError?.(e instanceof Error ? e : new Error(String(e)));
    return;
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const err = await res.json();
      if (typeof err.detail === "string") detail = err.detail;
      else if (Array.isArray(err.detail))
        detail = err.detail.map((e) => e.msg || e).join("; ");
      else if (err.detail) detail = JSON.stringify(err.detail);
    } catch {
      /* ignore */
    }
    onError?.(new Error(detail));
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    onError?.(new Error("No response body"));
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let sep;
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        const raw = buffer.slice(0, sep).trim();
        buffer = buffer.slice(sep + 2);
        if (!raw.startsWith("data:")) continue;
        const payload = raw.slice(5).trim();
        if (payload === "[DONE]") {
          onDone?.(full);
          return;
        }
        try {
          const obj = JSON.parse(payload);
          if (obj.error) {
            onError?.(new Error(obj.error));
            return;
          }
          if (typeof obj.token === "string" && obj.token) {
            full += obj.token;
            onToken?.(obj.token);
          }
        } catch {
          /* skip malformed line */
        }
      }
    }
    onDone?.(full);
  } catch (e) {
    if (isAbortError(e)) {
      onStop?.(full);
      return;
    }
    onError?.(e instanceof Error ? e : new Error(String(e)));
  }
}
