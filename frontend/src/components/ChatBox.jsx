import { useState, useRef, useEffect, useCallback } from "react";
import { sendPromptStream, ocrImage, processSpeechAudio } from "../services/api";
import "./ChatBox.css";

/** Whisper language codes — keep in sync with backend `app.services.speech.LANG_MAP` */
const SPEECH_LANGS = [
  ["hi", "Hindi"],
  ["te", "Telugu"],
  ["ta", "Tamil"],
  ["kn", "Kannada"],
  ["ml", "Malayalam"],
  ["bn", "Bengali"],
  ["mr", "Marathi"],
  ["gu", "Gujarati"],
  ["pa", "Punjabi"],
  ["ur", "Urdu"],
  ["or", "Odia"],
  ["en", "English"],
];

const SUGGESTIONS = [
  "Help me brainstorm ideas",
  "Explain a concept simply",
  "Short email draft",
];

function SendIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 5v12M5 12l7-7 7 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ImageMenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
      <circle cx="8.5" cy="10.5" r="1.5" fill="currentColor" />
      <path d="M21 15l-5-5-4 4-3-3-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function AudioMenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 14v4M8 10v8M12 6v12M16 9v9M20 12v6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 14a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3zM19 11a7 7 0 0 1-14 0M12 18v3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function pickRecorderMimeType() {
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  for (const t of types) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) {
      return t;
    }
  }
  return "";
}

/**
 * Records microphone audio for `seconds` and returns a Blob (WebM/OGG depending on browser).
 */
async function recordMicBlob(seconds) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mime = pickRecorderMimeType();
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks = [];
  rec.ondataavailable = (e) => {
    if (e.data?.size) chunks.push(e.data);
  };
  const stopped = new Promise((resolve) => {
    rec.onstop = () => resolve();
  });
  rec.start();
  await new Promise((r) => setTimeout(r, seconds * 1000));
  rec.stop();
  await stopped;
  stream.getTracks().forEach((t) => t.stop());
  const blobType = rec.mimeType || mime || "audio/webm";
  return new Blob(chunks, { type: blobType });
}

function CheckBadgeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#1e8e3e" />
      <path
        d="M8 12.5l2.5 2.5L16 9"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function ChatBox() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [imageContext, setImageContext] = useState("");
  const [imageAttachment, setImageAttachment] = useState(null);
  const [speechLang, setSpeechLang] = useState("hi");
  const [recordDurationSec, setRecordDurationSec] = useState(10);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [pendingAudio, setPendingAudio] = useState(null);
  const [speechBusy, setSpeechBusy] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSecLeft, setRecordSecLeft] = useState(0);
  const messagesEndRef = useRef(null);
  const abortRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const speechFileInputRef = useRef(null);
  const attachMenuRef = useRef(null);
  const attachMenuButtonRef = useRef(null);
  const recordIntervalRef = useRef(null);

  const resizeTextarea = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  useEffect(() => {
    resizeTextarea();
  }, [input, resizeTextarea]);

  const sendToAvatar = (text) => {
    try {
      document.getElementById("avatarFrame")?.contentWindow?.postMessage(
        { type: "AVATAR_SPEAK", text },
        "*"
      );
    } catch {
      /* ignore */
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const focusInput = useCallback(() => {
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  useEffect(() => {
    focusInput();
  }, [focusInput]);

  const handleStop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
  };

  const removeImageAttachment = useCallback(() => {
    setImageAttachment((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
    setImageContext("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const removePendingAudio = useCallback(() => {
    setPendingAudio(null);
    if (speechFileInputRef.current) speechFileInputRef.current.value = "";
  }, []);

  const applyTranscriptionResult = useCallback(
    (r) => {
      // Handle both error and success results
      if (r.error) {
        setError(r.error);
        return;
      }
      let text = (r.english_text || "").trim();
      if (r.lang_code !== "en" && (r.original_text || "").trim()) {
        text = `${text}\n\n[Original (${r.source_lang}): ${r.original_text.trim()}]`;
      }
      if (text) {
        setInput(text);
        setError(null); // Clear any previous errors
        focusInput();
      }
    },
    [focusInput]
  );

  const transcribeBlobOrFile = useCallback(
    async (blobOrFile) => {
      setSpeechBusy(true);
      setError(null);
      try {
        console.log(`[Audio] Sending to backend: size=${blobOrFile.size}, lang=${speechLang}`);
        const r = await processSpeechAudio(blobOrFile, speechLang);
        console.log("[Audio] Transcription successful:", r);
        applyTranscriptionResult(r);
        removePendingAudio();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Speech processing failed.";
        console.error("[Audio] Error:", msg);
        
        // Improve error messages for common issues
        let displayMsg = msg;
        if (msg.includes("Failed to fetch") || msg.includes("Network")) {
          displayMsg = "Cannot reach backend. Make sure it's running on http://localhost:5000";
        } else if (msg.includes("ffmpeg") || msg.includes("FFmpeg")) {
          displayMsg = "FFmpeg not installed. Install from: https://ffmpeg.org/download.html";
        } else if (msg.includes("No speech detected")) {
          displayMsg = "No speech detected. Speak clearly and try again.";
        } else if (msg.includes("Empty")) {
          displayMsg = "Recording is empty. Try recording again.";
        } else if (msg.includes("Audio file not found")) {
          displayMsg = "Audio processing error: FFmpeg may not be installed.";
        }
        
        setError(displayMsg);
        removePendingAudio();
      } finally {
        setSpeechBusy(false);
      }
    },
    [speechLang, applyTranscriptionResult, removePendingAudio]
  );

  useEffect(() => {
    if (!attachMenuOpen) return;
    const onDown = (e) => {
      const menu = attachMenuRef.current;
      const btn = attachMenuButtonRef.current;
      const t = e.target;
      if (menu?.contains(t) || btn?.contains(t)) return;
      setAttachMenuOpen(false);
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [attachMenuOpen]);

  useEffect(
    () => () => {
      if (recordIntervalRef.current) {
        clearInterval(recordIntervalRef.current);
        recordIntervalRef.current = null;
      }
    },
    []
  );

  const onPickImage = () => {
    setAttachMenuOpen(false);
    requestAnimationFrame(() => fileInputRef.current?.click());
  };

  const onPickAudioFile = () => {
    setAttachMenuOpen(false);
    requestAnimationFrame(() => speechFileInputRef.current?.click());
  };

  const toggleAttachMenu = () => {
    setAttachMenuOpen((o) => !o);
  };

  const onSpeechFileSelected = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingAudio({ file, fileName: file.name || "Audio" });
    setAttachMenuOpen(false);
  };

  const onTranscribePendingAudio = () => {
    if (!pendingAudio?.file) return;
    transcribeBlobOrFile(pendingAudio.file);
  };

  const startMicRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Microphone is not supported in this browser.");
      return;
    }
    const seconds = recordDurationSec;
    setAttachMenuOpen(false);
    setError(null);
    setIsRecording(true);
    setRecordSecLeft(seconds);
    if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
    recordIntervalRef.current = setInterval(() => {
      setRecordSecLeft((s) => Math.max(0, s - 1));
    }, 1000);
    try {
      const blob = await recordMicBlob(seconds);
      await transcribeBlobOrFile(blob);
    } catch (err) {
      const name = err && typeof err === "object" ? err.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setError("Microphone permission denied.");
      } else {
        const msg = err instanceof Error ? err.message : "Could not record from microphone.";
        setError(msg);
      }
    } finally {
      if (recordIntervalRef.current) {
        clearInterval(recordIntervalRef.current);
        recordIntervalRef.current = null;
      }
      setIsRecording(false);
      setRecordSecLeft(0);
    }
  };

  const onImageSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageAttachment((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return {
        previewUrl: URL.createObjectURL(file),
        fileName: file.name || "Image",
        phase: "extracting",
      };
    });
    setImageContext("");

    try {
      const { text } = await ocrImage(file);
      const t = typeof text === "string" ? text : "";
      if (!t.trim()) {
        setImageAttachment((prev) =>
          prev ? { ...prev, phase: "error", errorText: "No text found in this image." } : null
        );
      } else {
        setImageContext(t);
        setImageAttachment((prev) => (prev ? { ...prev, phase: "ready" } : null));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not read the image.";
      setImageAttachment((prev) =>
        prev ? { ...prev, phase: "error", errorText: msg } : null
      );
    }
  };

  const handleSend = async () => {
    const userText = input.trim();
    const hasCtx = Boolean(imageContext.trim());
    if (loading || (!userText && !hasCtx)) return;

    const displayText =
      userText || (hasCtx ? "📷 Image text as context" : "");
    setMessages((prev) => [...prev, { role: "user", text: displayText }]);
    setInput("");
    const ctxToSend = imageContext.trim();
    setLoading(true);
    setError(null);

    setMessages((prev) => [
      ...prev,
      { role: "bot", text: "", streaming: true },
    ]);

    const ac = new AbortController();
    abortRef.current = ac;

    await sendPromptStream(
      userText,
      { signal: ac.signal, imageContext: ctxToSend || undefined },
      {
      onToken: (token) => {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === "bot" && last.streaming) {
            next[next.length - 1] = { ...last, text: last.text + token };
          }
          return next;
        });
      },
      onDone: (full) => {
        abortRef.current = null;
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === "bot") {
            next[next.length - 1] = {
              role: "bot",
              text: full || last.text,
              streaming: false,
            };
          }
          return next;
        });
        if (full) sendToAvatar(full);
        if (ctxToSend) removeImageAttachment();
        setLoading(false);
        focusInput();
      },
      onStop: () => {
        abortRef.current = null;
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === "bot" && last.streaming) {
            if (!last.text?.trim()) return next.slice(0, -1);
            next[next.length - 1] = {
              role: "bot",
              text: last.text,
              streaming: false,
              stopped: true,
            };
          }
          return next;
        });
        setLoading(false);
        focusInput();
      },
      onError: (err) => {
        abortRef.current = null;
        setError(err.message || "Something went wrong");
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last?.role === "bot" && last.streaming && !last.text) {
            return next.slice(0, -1);
          }
          if (last?.role === "bot" && last.streaming) {
            next[next.length - 1] = { ...last, streaming: false };
          }
          return next;
        });
        setLoading(false);
        focusInput();
      },
    }
    );
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const ocrBusy = imageAttachment?.phase === "extracting";
  const micOrSpeechBusy = speechBusy || isRecording;
  const canSend =
    !loading &&
    !ocrBusy &&
    !micOrSpeechBusy &&
    (Boolean(input.trim()) || Boolean(imageContext.trim()));

  const clearChat = () => {
    handleStop();
    setMessages([]);
    setError(null);
    removeImageAttachment();
    removePendingAudio();
    focusInput();
  };

  return (
    <div className="chatbox-container">
      <header className="chat-header">
        <h1 className="chat-brand">Chat</h1>
        {messages.length > 0 && (
          <button type="button" className="chat-clear" onClick={clearChat}>
            Clear chat
          </button>
        )}
      </header>

      <div
        className="messages-scroll"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {messages.length === 0 && (
          <div className="gemini-empty">
            <div className="gemini-orb" aria-hidden="true" />
            <p className="gemini-empty-title">How can I help?</p>
            <p className="gemini-empty-sub">
              Answers stream in as they&apos;re generated.
            </p>
            <div className="gemini-chips">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="gemini-chip"
                  onClick={() => {
                    setInput(s);
                    focusInput();
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="messages-list">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`msg msg--${m.role}${m.streaming ? " msg--streaming" : ""}`}
            >
              <div className="msg-bubble">
                {m.text}
                {m.streaming && <span className="stream-dot" aria-hidden="true" />}
                {m.stopped && m.text && (
                  <span className="msg-stopped">Generation stopped</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="msg msg--error">
            <div className="msg-bubble msg-bubble--error">{error}</div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <footer className="chat-footer">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.heic,.heif,.jfif,.jpe,.bmp,.tif,.tiff,.webp,.avif"
          className="ocr-file-input"
          aria-hidden="true"
          tabIndex={-1}
          onChange={onImageSelected}
        />
        <input
          ref={speechFileInputRef}
          type="file"
          accept="audio/*,.webm,.wav,.mp3,.m4a,.ogg,.opus,.flac,.mp4"
          className="ocr-file-input"
          aria-hidden="true"
          tabIndex={-1}
          onChange={onSpeechFileSelected}
        />
        <div
          className={`gemini-composer${loading ? " is-busy" : ""}${imageAttachment || pendingAudio ? " has-attachment" : ""}`}
        >
          {imageAttachment && (
            <div className="composer-attachment" aria-live="polite">
              <div
                className={`attach-card attach-card--${imageAttachment.phase}`}
              >
                <div className="attach-thumb-wrap">
                  <img
                    src={imageAttachment.previewUrl}
                    alt=""
                    className="attach-thumb"
                  />
                  {imageAttachment.phase === "extracting" && (
                    <div className="attach-thumb-overlay">
                      <span className="attach-spinner" aria-hidden="true" />
                      <span className="attach-overlay-label">Scanning…</span>
                    </div>
                  )}
                  {imageAttachment.phase === "ready" && (
                    <div className="attach-ready-badge" title="Text extracted">
                      <CheckBadgeIcon />
                    </div>
                  )}
                </div>
                <div className="attach-meta">
                  <span className="attach-filename" title={imageAttachment.fileName}>
                    {imageAttachment.fileName}
                  </span>
                  {imageAttachment.phase === "extracting" && (
                    <span className="attach-status">Extracting text from image</span>
                  )}
                  {imageAttachment.phase === "ready" && (
                    <span className="attach-status attach-status--ok">
                      {imageContext.length.toLocaleString()} characters · included with your
                      message
                    </span>
                  )}
                  {imageAttachment.phase === "error" && (
                    <span className="attach-status attach-status--err">
                      {imageAttachment.errorText}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="attach-dismiss"
                  onClick={removeImageAttachment}
                  aria-label="Remove attachment"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M6 6l12 12M18 6L6 18"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
          )}
          {pendingAudio && (
            <div className="composer-attachment composer-attachment--audio" aria-live="polite">
              <div className="attach-card attach-card--audio">
                <div className="attach-thumb-wrap attach-thumb-wrap--audio" aria-hidden="true">
                  <AudioMenuIcon />
                </div>
                <div className="attach-meta">
                  <span className="attach-filename" title={pendingAudio.fileName}>
                    {pendingAudio.fileName}
                  </span>
                  <span className="attach-status">
                    Language: {SPEECH_LANGS.find(([c]) => c === speechLang)?.[1] ?? speechLang}.
                    Transcribe to fill the prompt, then send.
                  </span>
                  <div className="attach-audio-row">
                    <button
                      type="button"
                      className="attach-transcribe-btn"
                      onClick={onTranscribePendingAudio}
                      disabled={speechBusy || loading || ocrBusy}
                    >
                      {speechBusy ? "Transcribing…" : "Transcribe to text"}
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  className="attach-dismiss"
                  onClick={removePendingAudio}
                  aria-label="Remove audio attachment"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M6 6l12 12M18 6L6 18"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
          )}
          <div className="composer-speech-toolbar" aria-label="Speech input settings">
            <label className="speech-lang-field">
              <span className="speech-lang-label">Speech language</span>
              <select
                className="speech-lang-select"
                value={speechLang}
                onChange={(e) => setSpeechLang(e.target.value)}
                disabled={loading || ocrBusy || speechBusy || isRecording}
                aria-label="Language for speech recognition"
              >
                {SPEECH_LANGS.map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <div className="record-duration" role="group" aria-label="Microphone recording length">
              <span className="record-duration-label">Mic length</span>
              <div className="record-duration-toggle">
                <button
                  type="button"
                  className={`record-duration-btn${recordDurationSec === 5 ? " is-active" : ""}`}
                  onClick={() => setRecordDurationSec(5)}
                  disabled={loading || ocrBusy || speechBusy || isRecording}
                  aria-pressed={recordDurationSec === 5}
                >
                  5s
                </button>
                <button
                  type="button"
                  className={`record-duration-btn${recordDurationSec === 10 ? " is-active" : ""}`}
                  onClick={() => setRecordDurationSec(10)}
                  disabled={loading || ocrBusy || speechBusy || isRecording}
                  aria-pressed={recordDurationSec === 10}
                >
                  10s
                </button>
                <button
                  type="button"
                  className={`record-duration-btn${recordDurationSec === 15 ? " is-active" : ""}`}
                  onClick={() => setRecordDurationSec(15)}
                  disabled={loading || ocrBusy || speechBusy || isRecording}
                  aria-pressed={recordDurationSec === 15}
                >
                  15s
                </button>
              </div>
            </div>
          </div>
          <div className="gemini-composer-row">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter a prompt"
              disabled={loading || ocrBusy || micOrSpeechBusy}
              rows={1}
              className="gemini-input"
              aria-label="Message"
            />
            <div className="gemini-composer-actions">
              {loading && (
                <button
                  type="button"
                  className="gemini-stop"
                  onClick={handleStop}
                  aria-label="Stop"
                />
              )}
              <div className="attach-menu-anchor" ref={attachMenuRef}>
                <button
                  ref={attachMenuButtonRef}
                  type="button"
                  className={`gemini-attach${attachMenuOpen ? " is-open" : ""}`}
                  onClick={toggleAttachMenu}
                  disabled={loading || ocrBusy || micOrSpeechBusy}
                  aria-label="Add attachment"
                  aria-expanded={attachMenuOpen}
                  aria-haspopup="menu"
                  title="Image or audio file"
                >
                  <PlusIcon />
                </button>
                {attachMenuOpen && (
                  <div className="attach-menu" role="menu">
                    <button
                      type="button"
                      role="menuitem"
                      className="attach-menu-item"
                      onClick={onPickImage}
                    >
                      <span className="attach-menu-item-icon" aria-hidden="true">
                        <ImageMenuIcon />
                      </span>
                      <span className="attach-menu-item-text">
                        <span className="attach-menu-item-title">Image</span>
                        <span className="attach-menu-item-sub">Extract text (OCR) as context</span>
                      </span>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="attach-menu-item"
                      onClick={onPickAudioFile}
                    >
                      <span className="attach-menu-item-icon" aria-hidden="true">
                        <AudioMenuIcon />
                      </span>
                      <span className="attach-menu-item-text">
                        <span className="attach-menu-item-title">Audio file</span>
                        <span className="attach-menu-item-sub">Transcribe with selected language</span>
                      </span>
                    </button>
                  </div>
                )}
              </div>
              <button
                type="button"
                className={`gemini-mic${isRecording ? " is-recording" : ""}${speechBusy ? " is-busy" : ""}`}
                onClick={startMicRecording}
                disabled={loading || ocrBusy || speechBusy || isRecording}
                aria-label={
                  isRecording ?
                    `Recording, ${recordSecLeft} seconds left`
                  : `Record from microphone (${recordDurationSec} seconds)`
                }
                title={`Record ${recordDurationSec}s from microphone`}
              >
                {isRecording ?
                  <span className="gemini-mic-countdown">{recordSecLeft}</span>
                : <MicIcon />}
              </button>
              <button
                type="button"
                className="gemini-send"
                onClick={handleSend}
                disabled={!canSend}
                aria-label="Send"
              >
                <SendIcon />
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
