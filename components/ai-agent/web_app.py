import os
import sys
import uuid
from typing import Dict, List, Optional

from fastapi import Body, FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from rag.vectorstore import get_or_create_vectorstore
from rag.qa import create_qa_chain, is_probably_dental

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")


# ---------- Schemas ----------
class ChatRequest(BaseModel):
    message: str = Field(..., description="User message")
    age: Optional[int] = Field(None, description="Patient age")
    session_id: Optional[str] = Field(None, description="Session identifier")


class EmergencyInfo(BaseModel):
    red_flags: List[str] = Field(default_factory=list)
    advice: Optional[str] = None


class TriageInfo(BaseModel):
    specialty: Optional[str] = None
    is_final: bool = False
    confidence: Optional[float] = None


class FollowUpInfo(BaseModel):
    questions: List[str] = Field(default_factory=list)


class SourceInfo(BaseModel):
    source: str
    snippet: str
    score: Optional[float] = None


class ChatResponse(BaseModel):
    session_id: str
    state: str
    answer: str
    is_emergency: bool
    emergency: Optional[EmergencyInfo]
    triage: TriageInfo
    follow_up: FollowUpInfo
    sources: List[SourceInfo]


# ---------- App setup ----------
app = FastAPI(title="Dental RAG Assistant")

backend = os.getenv("DENTAL_LLM_BACKEND", "groq")
vectordb = get_or_create_vectorstore()
qa = create_qa_chain(vectordb, backend=backend)

static_dir = os.path.join(os.path.dirname(__file__), "static")
app.mount("/static", StaticFiles(directory=static_dir), name="static")

SESSIONS: Dict[str, dict] = {}


# ---------- Helpers ----------
def _get_session(session_id: Optional[str]) -> tuple[str, dict]:
    if not session_id or session_id not in SESSIONS:
        session_id = str(uuid.uuid4())
        SESSIONS[session_id] = {"age": None, "history": []}
    return session_id, SESSIONS[session_id]


def detect_emergency(text: str) -> EmergencyInfo:
    red_flag_terms = ["تورم", "انتفاخ", "حرارة", "صعوبة بلع", "صعوبة تنفس", "يوقظ من النوم", "ألم ليلي"]
    found = [t for t in red_flag_terms if t in (text or "")]
    if not found:
        return EmergencyInfo(red_flags=[], advice=None)
    advice = "يُنصح بمراجعة الطوارئ فوراً" if any(t in text for t in ["صعوبة بلع", "صعوبة تنفس"]) else "يُنصح بزيارة طبيب الأسنان بشكل عاجل."
    return EmergencyInfo(red_flags=found, advice=advice)


SPECIALTY_MAP = {
    "ترميم": "ترميمية",
    "لب": "لبية",
    "لثة": "لثوية",
    "تعويض ثابت": "تعويضات ثابتة",
    "تعويض متحرك": "تعويضات متحركة",
    "أطفال": "أسنان أطفال",
}


def parse_specialty(output_text: str) -> Optional[str]:
    if not output_text:
        return None
    lower = output_text.lower()
    for key, value in SPECIALTY_MAP.items():
        if key in lower:
            return value
    return None


def format_sources(docs: List) -> List[SourceInfo]:
    formatted: List[SourceInfo] = []
    for doc in docs or []:
        meta = doc.metadata or {}
        score = meta.get("score") or meta.get("similarity_score")
        formatted.append(
            SourceInfo(
                source=str(meta.get("source", "unknown")),
                snippet=(doc.page_content or "")[:200],
                score=float(score) if score is not None else None,
            )
        )
    return formatted


def normalize_response(
    session_id: str,
    user_text: str,
    age: Optional[int],
    qa_result: dict,
) -> ChatResponse:
    answer = ""
    docs = []
    if isinstance(qa_result, dict):
        answer = qa_result.get("result", "") or qa_result.get("answer", "") or ""
        docs = qa_result.get("source_documents", []) or []
    else:
        answer = str(qa_result or "")

    # Emergency detection (user + model)
    em_user = detect_emergency(user_text)
    em_model = detect_emergency(answer)
    red_flags = list({*em_user.red_flags, *em_model.red_flags})
    is_emergency = bool(red_flags)
    emergency_obj = EmergencyInfo(red_flags=red_flags, advice=em_user.advice or em_model.advice) if is_emergency else None

    # Greeting-only: treat as need_followup, not non_dental
    greetings = {"مرحبا", "اهلا", "هاي", "السلام عليكم"}
    is_greeting_only = user_text.strip() in greetings

    # Determine state
    specialty = parse_specialty(answer)
    if age is None:
        state = "need_age"
    elif not is_greeting_only and not is_probably_dental(user_text):
        state = "non_dental"
    elif specialty:
        state = "triaged"
    else:
        state = "need_followup"

    # Enforce triage null when not triaged
    triage = TriageInfo(
        specialty=specialty if state == "triaged" else None,
        is_final=True if state == "triaged" else False,
        confidence=0.7 if state == "triaged" else None,
    )

    follow_up_questions: List[str] = []
    if state == "need_age":
        follow_up_questions = ["كم عمرك بالسنوات؟"]
    elif state == "need_followup":
        follow_up_questions = ["يرجى وصف الألم أو الشكوى بالتفصيل."]

    return ChatResponse(
        session_id=session_id,
        state=state,
        answer=answer,
        is_emergency=is_emergency,
        emergency=emergency_obj,
        triage=triage,
        follow_up=FollowUpInfo(questions=follow_up_questions),
        sources=format_sources(docs),
    )


# ---------- Routes ----------
@app.get("/", response_class=HTMLResponse)
async def root() -> HTMLResponse:
    index_path = os.path.join(static_dir, "index.html")
    with open(index_path, "r", encoding="utf-8") as f:
        return HTMLResponse(f.read())


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    session_id, session = _get_session(request.session_id)

    # store age if provided
    if request.age is not None:
        session["age"] = request.age

    text = (request.message or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="message is required")

    # Need age first
    if session.get("age") is None:
        return ChatResponse(
            session_id=session_id,
            state="need_age",
            answer="من فضلك أدخل عمرك.",
            is_emergency=False,
            emergency=None,
            triage=TriageInfo(),
            follow_up=FollowUpInfo(questions=["كم عمرك بالسنوات؟"]),
            sources=[],
        )

    age_prefix = f"عمر المريض: {session['age']}.\n"
    query = age_prefix + "وصف الحالة: " + text

    try:
        result = qa.invoke({"query": query, "age": session["age"]})
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    # track history (raw)
    session["history"].append({"role": "user", "content": text})
    # normalize and respond
    response = normalize_response(session_id=session_id, user_text=text, age=session.get("age"), qa_result=result)
    session["history"].append({"role": "assistant", "content": response.answer})
    session["last_state"] = response.state
    session["last_triage"] = response.triage.model_dump()

    return response
