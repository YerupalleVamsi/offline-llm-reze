import os
import sqlite3
from pathlib import Path
from typing import List, Optional, Set, Tuple

# backend/data/assistant.db
_BACKEND_ROOT = Path(__file__).resolve().parent.parent
DB_PATH = str(_BACKEND_ROOT / "data" / "assistant.db")

_conn: Optional[sqlite3.Connection] = None


def _connect() -> sqlite3.Connection:
    global _conn
    if _conn is not None:
        return _conn
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    _conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    _conn.row_factory = sqlite3.Row
    _conn.execute("PRAGMA journal_mode=WAL;")
    _conn.execute("PRAGMA synchronous=NORMAL;")
    _conn.execute("PRAGMA foreign_keys=ON;")
    return _conn


def _table_columns(conn: sqlite3.Connection, table: str) -> Set[str]:
    allowed = {"memory", "conversations"}
    if table not in allowed:
        raise ValueError("invalid table")
    cur = conn.execute(f"PRAGMA table_info({table})")
    return {row["name"] for row in cur.fetchall()}


def _dedupe_memory(conn: sqlite3.Connection) -> None:
    try:
        conn.execute(
            """
            DELETE FROM memory
            WHERE id NOT IN (
                SELECT MAX(id) FROM memory GROUP BY user_id, key
            )
            """
        )
    except sqlite3.OperationalError:
        pass


def init_db() -> None:
    conn = _connect()
    cur = conn.cursor()

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            message TEXT NOT NULL,
            response TEXT NOT NULL,
            timestamp TEXT NOT NULL DEFAULT (datetime('now'))
        )
        """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS memory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            key TEXT NOT NULL,
            value TEXT NOT NULL,
            updated_at TEXT DEFAULT (datetime('now'))
        )
        """
    )

    mem_cols = _table_columns(conn, "memory")
    if "updated_at" not in mem_cols:
        try:
            conn.execute(
                "ALTER TABLE memory ADD COLUMN updated_at TEXT DEFAULT (datetime('now'))"
            )
        except sqlite3.OperationalError:
            pass

    _dedupe_memory(conn)

    cur.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_conversations_user_time
        ON conversations (user_id, timestamp DESC)
        """
    )
    cur.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_memory_user
        ON memory (user_id)
        """
    )

    conn.commit()


def save_conversation(user_id: int, message: str, response: str) -> None:
    conn = _connect()
    conn.execute(
        """
        INSERT INTO conversations (user_id, message, response)
        VALUES (?, ?, ?)
        """,
        (user_id, message, response),
    )
    conn.commit()


def get_recent_history(user_id: int, limit: int = 10) -> List[Tuple[str, str]]:
    conn = _connect()
    cur = conn.execute(
        """
        SELECT message, response FROM conversations
        WHERE user_id = ?
        ORDER BY timestamp DESC, id DESC
        LIMIT ?
        """,
        (user_id, limit),
    )
    rows = cur.fetchall()
    return [(r["message"], r["response"]) for r in rows][::-1]


def save_memory(user_id: int, key: str, value: str) -> None:
    conn = _connect()
    k, v = key.strip(), value.strip()
    if not k or not v:
        return

    conn.execute("DELETE FROM memory WHERE user_id = ? AND key = ?", (user_id, k))

    cols = _table_columns(conn, "memory")
    if "updated_at" in cols:
        conn.execute(
            """
            INSERT INTO memory (user_id, key, value, updated_at)
            VALUES (?, ?, ?, datetime('now'))
            """,
            (user_id, k, v),
        )
    else:
        conn.execute(
            "INSERT INTO memory (user_id, key, value) VALUES (?, ?, ?)",
            (user_id, k, v),
        )
    conn.commit()


def get_memory(user_id: int) -> str:
    conn = _connect()
    cur = conn.execute(
        """
        SELECT key, value FROM memory
        WHERE user_id = ?
        ORDER BY key
        """,
        (user_id,),
    )
    lines = [f"{r['key']}: {r['value']}" for r in cur.fetchall()]
    return "\n".join(lines) + ("\n" if lines else "")
