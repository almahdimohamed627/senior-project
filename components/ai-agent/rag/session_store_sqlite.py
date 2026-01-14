# rag/session_store_sqlite.py
import json
import os
import sqlite3
import threading
import time
from typing import Any, Dict, Optional


def new_session_payload() -> Dict[str, Any]:
    return {
        "age": None,
        "history": [],
        "case_parts": [],
        "last_state": None,
        "last_triage": None,
        "last_answer": None,
        "image_ai": None,   # dict
        "last_case_text": None,
        "last_is_emergency": False,
        "last_emergency": None,
        "updated_at": time.time(),
    }


class SQLiteSessionStore:
    """
    Simple persistent session store using builtin sqlite3 (no extra deps).
    Stores payload as JSON string.
    """

    def __init__(self, path: str):
        self.path = path
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        self.conn = sqlite3.connect(self.path, check_same_thread=False)
        self.conn.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                session_id TEXT PRIMARY KEY,
                payload TEXT NOT NULL,
                updated_at REAL NOT NULL
            )
            """
        )
        self.conn.commit()
        self._lock = threading.Lock()

    @classmethod
    def from_env(cls) -> "SQLiteSessionStore":
        path = os.getenv("DENTAL_SQLITE_PATH", "sessions.db").strip() or "sessions.db"
        return cls(path)

    async def get(self, session_id: str) -> Optional[Dict[str, Any]]:
        if not session_id:
            return None
        with self._lock:
            cur = self.conn.execute(
                "SELECT payload FROM sessions WHERE session_id = ?",
                (session_id,),
            )
            row = cur.fetchone()
        if not row:
            return None
        try:
            return json.loads(row[0])
        except Exception:
            return None

    async def set(self, session_id: str, payload: Dict[str, Any]) -> None:
        payload = payload or {}
        payload["updated_at"] = time.time()
        data = json.dumps(payload, ensure_ascii=False)
        with self._lock:
            self.conn.execute(
                """
                INSERT INTO sessions(session_id, payload, updated_at)
                VALUES(?, ?, ?)
                ON CONFLICT(session_id) DO UPDATE SET
                    payload=excluded.payload,
                    updated_at=excluded.updated_at
                """,
                (session_id, data, payload["updated_at"]),
            )
            self.conn.commit()

    async def close(self) -> None:
        with self._lock:
            try:
                self.conn.close()
            except Exception:
                pass
