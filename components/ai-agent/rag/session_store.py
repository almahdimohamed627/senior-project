# rag/session_store.py
import json
import os
from typing import Any, Dict, Optional

from redis.asyncio import Redis
from redis.asyncio import from_url


def _env_int(name: str, default: int) -> int:
    raw = (os.getenv(name, "") or "").strip()
    try:
        return int(raw)
    except Exception:
        return default


def new_session_payload() -> Dict[str, Any]:
    return {
        "age": None,
        "history": [],
        "last_state": None,
        "last_triage": None,
        "case_parts": [],
        "last_case_text": None,
        "image_ai": None,  # آخر نتيجة مودل الصورة
    }


class RedisSessionStore:
    def __init__(self, redis: Redis, ttl_seconds: int = 0):
        self.redis = redis
        self.ttl_seconds = max(0, int(ttl_seconds or 0))

    @classmethod
    def from_env(cls) -> "RedisSessionStore":
        url = (os.getenv("REDIS_URL") or "redis://localhost:6379/0").strip()
        ttl = _env_int("DENTAL_SESSION_TTL_SECONDS", 0)  # 0 = بدون انتهاء
        r = from_url(url, decode_responses=True)
        return cls(r, ttl_seconds=ttl)

    async def get(self, session_id: str) -> Optional[Dict[str, Any]]:
        if not session_id:
            return None
        raw = await self.redis.get(session_id)
        if not raw:
            return None
        try:
            data = json.loads(raw)
            if isinstance(data, dict):
                return data
        except Exception:
            return None
        return None

    async def set(self, session_id: str, payload: Dict[str, Any]) -> None:
        if not session_id:
            return
        raw = json.dumps(payload, ensure_ascii=False)
        if self.ttl_seconds > 0:
            await self.redis.setex(session_id, self.ttl_seconds, raw)
        else:
            await self.redis.set(session_id, raw)

    async def close(self) -> None:
        try:
            await self.redis.close()
        except Exception:
            pass
