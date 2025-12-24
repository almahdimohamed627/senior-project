import os
import sys
import uuid
from typing import Dict, List, Optional

from fastapi import Body, FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from rag.vectorstore import get_or_create_vectorstore
from rag.qa import create_qa_chain

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

app = FastAPI(title="Dental RAG Assistant")

vectordb = get_or_create_vectorstore()
qa = create_qa_chain(vectordb)

static_dir = os.path.join(os.path.dirname(__file__), "static")
app.mount("/static", StaticFiles(directory=static_dir), name="static")

SESSIONS: Dict[str, dict] = {}


def _get_session(session_id: Optional[str]) -> tuple[str, dict]:
    if not session_id or session_id not in SESSIONS:
        session_id = str(uuid.uuid4())
        SESSIONS[session_id] = {"age": None, "history": []}
    return session_id, SESSIONS[session_id]


@app.get("/", response_class=HTMLResponse)
async def root() -> HTMLResponse:
    index_path = os.path.join(static_dir, "index.html")
    with open(index_path, "r", encoding="utf-8") as f:
        return HTMLResponse(f.read())


@app.post("/api/chat")
async def chat(
    message: Optional[str] = Body(None, embed=True),
    age: Optional[int] = Body(None, embed=True),
    session_id: Optional[str] = Body(None, embed=True),
) -> dict:
    session_id, session = _get_session(session_id)

    if age is not None:
        session["age"] = age

    text = (message or "").strip()

    if session.get("age") is None:
        return {
            "answer": "أهلاً! أدخل عمر المريض أولاً (بالسنين)، ثم صف الشكوى.",
            "sources": [],
            "session_id": session_id,
            "need_age": True,
        }

    if not text:
        raise HTTPException(status_code=400, detail="message is required")

    age_prefix = f"عمر المريض: {session['age']} سنة.\n"
    query = age_prefix + "شكوى المريض: " + text

    try:
        result = qa.invoke({"query": query, "age": session["age"]})
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    sources: List[dict] = []
    for doc in result.get("source_documents", []):
        meta = doc.metadata or {}
        sources.append({"source": meta.get("source", "unknown")})

    session["history"].append({"user": text, "answer": result.get("result", "")})

    return {
        "answer": result.get("result", ""),
        "sources": sources,
        "session_id": session_id,
        "need_age": False,
    }
