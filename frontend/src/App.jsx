import { useState, useEffect, useRef, useCallback } from "react";
import Home from "./pages/Home";
import "./App.css";

const MIN_LEFT = 260;
const MIN_RIGHT = 200;
const DEFAULT_LEFT = 420;
const SPLIT_STORAGE_KEY = "split_left_px";
const DESKTOP_MQ = "(min-width: 901px)";
const HANDLE_VISUAL = 5;

function readStoredLeft() {
  try {
    const v = localStorage.getItem(SPLIT_STORAGE_KEY);
    const n = v ? parseInt(v, 10) : DEFAULT_LEFT;
    return Number.isFinite(n) ? n : DEFAULT_LEFT;
  } catch {
    return DEFAULT_LEFT;
  }
}

function clampLeftPx(x, shellWidth) {
  const max = Math.max(MIN_LEFT, shellWidth - MIN_RIGHT - HANDLE_VISUAL);
  return Math.min(max, Math.max(MIN_LEFT, x));
}

function App() {
  const [leftPx, setLeftPx] = useState(readStoredLeft);
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(DESKTOP_MQ).matches : true
  );
  const [isResizing, setIsResizing] = useState(false);

  const shellRef = useRef(null);
  const leftPanelRef = useRef(null);
  const draggingRef = useRef(false);
  const lastWidthRef = useRef(leftPx);
  const rafRef = useRef(null);
  const pendingXRef = useRef(null);

  const applyWidthFromClientX = useCallback((clientX) => {
    const shell = shellRef.current;
    const leftEl = leftPanelRef.current;
    if (!shell || !leftEl) return;
    const rect = shell.getBoundingClientRect();
    const w = clampLeftPx(clientX - rect.left, rect.width);
    lastWidthRef.current = w;
    leftEl.style.width = `${w}px`;
  }, []);

  const flushPendingWidth = useCallback(() => {
    rafRef.current = null;
    const x = pendingXRef.current;
    if (x == null || !draggingRef.current) return;
    applyWidthFromClientX(x);
  }, [applyWidthFromClientX]);

  const scheduleWidth = useCallback(
    (clientX) => {
      pendingXRef.current = clientX;
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(flushPendingWidth);
    },
    [flushPendingWidth]
  );

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_MQ);
    const onChange = () => setIsDesktop(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const onResize = () => {
      if (!window.matchMedia(DESKTOP_MQ).matches) return;
      const shell = shellRef.current;
      if (!shell) return;
      const rect = shell.getBoundingClientRect();
      setLeftPx((w) => clampLeftPx(w, rect.width));
    };
    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!isDesktop) return;
    try {
      localStorage.setItem(SPLIT_STORAGE_KEY, String(leftPx));
    } catch {
      /* ignore */
    }
  }, [leftPx, isDesktop]);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const endDrag = useCallback(() => {
    if (!draggingRef.current) return;
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (pendingXRef.current != null) {
      applyWidthFromClientX(pendingXRef.current);
    }
    draggingRef.current = false;
    setIsResizing(false);
    document.body.classList.remove("app-split-dragging");
    pendingXRef.current = null;
    setLeftPx(lastWidthRef.current);
  }, [applyWidthFromClientX]);

  useEffect(() => {
    const onPointerUp = () => endDrag();
    const onPointerMove = (e) => {
      if (!draggingRef.current) return;
      scheduleWidth(e.clientX);
    };
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => {
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, [endDrag, scheduleWidth]);

  const onHandlePointerDown = (e) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.preventDefault();
    draggingRef.current = true;
    setIsResizing(true);
    document.body.classList.add("app-split-dragging");
    lastWidthRef.current = leftPx;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    scheduleWidth(e.clientX);
  };

  const onLostPointerCapture = () => {
    endDrag();
  };

  const leftStyle =
    isDesktop ?
      {
        width: leftPx,
        flex: "none",
        minWidth: 0,
        maxWidth: "none",
      }
    : undefined;

  return (
    <div
      ref={shellRef}
      className={`app-shell${isResizing ? " app-shell--resizing" : ""}`}
    >
      <div ref={leftPanelRef} className="app-left" style={leftStyle}>
        <Home />
      </div>
      {isDesktop && (
        <div
          className="split-handle"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize chat and avatar panels"
          tabIndex={0}
          onPointerDown={onHandlePointerDown}
          onLostPointerCapture={onLostPointerCapture}
          onKeyDown={(e) => {
            const shell = shellRef.current;
            const step = 28;
            if (!shell) return;
            const rect = shell.getBoundingClientRect();
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              setLeftPx((w) => clampLeftPx(w - step, rect.width));
            } else if (e.key === "ArrowRight") {
              e.preventDefault();
              setLeftPx((w) => clampLeftPx(w + step, rect.width));
            }
          }}
        />
      )}
      <div className="app-right">
        <iframe
          title="Avatar"
          id="avatarFrame"
          className="avatar-frame"
          src="/avatar/index.html"
          allow="autoplay; microphone"
        />
      </div>
    </div>
  );
}

export default App;
