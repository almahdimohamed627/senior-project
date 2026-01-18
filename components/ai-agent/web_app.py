import os
import re
import sys
import uuid
from typing import Any, Dict, List, Optional, Tuple

from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
try:
    from pydantic import ConfigDict
except ImportError:
    ConfigDict = None
from dotenv import load_dotenv

from rag.vectorstore import get_or_create_vectorstore
from rag.qa import create_qa_chain, is_probably_dental
from rag.session_store_sqlite import SQLiteSessionStore, new_session_payload

load_dotenv()

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")


class ChatRequest(BaseModel):
    message: str = Field(..., description="User message")
    age: Optional[int] = Field(None, description="Patient age")
    session_id: Optional[str] = Field(None, description="Session identifier")

    if ConfigDict is not None:
        model_config = ConfigDict(extra="ignore")
    else:
        class Config:
            extra = "ignore"


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

EMPTY_EMERGENCY = EmergencyInfo(red_flags=[], advice=None)


app = FastAPI(title="Dental RAG Assistant")

backend = "groq"
vectordb = get_or_create_vectorstore()
qa = create_qa_chain(vectordb, backend=backend)

static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

store: Optional[SQLiteSessionStore] = None


@app.on_event("startup")
async def _startup():
    global store
    store = SQLiteSessionStore.from_env()


@app.on_event("shutdown")
async def _shutdown():
    global store
    if store:
        await store.close()
        store = None


GREETINGS = {"مرحبا", "اهلا", "أهلا", "هاي", "السلام عليكم", "سلام", "hello", "hi", "كيفك", "شلونك", "كيف الحال"}
ARABIC_DIACRITICS = re.compile(r"[\u0617-\u061A\u064B-\u0652\u0670\u0640]")
FOLLOWUP_SECTION_RE = re.compile(
    r"(?:\*\*?\s*)?(?:اسئلة|أسئلة)\s+متابعة(?:\s*\*\*?)?",
    re.IGNORECASE,
)
NUMBERED_QUESTION_RE = re.compile(r"(?:^|\n)\s*\d{1,2}[\)\.\-]\s+.*?[؟?]", re.MULTILINE)
UNCERTAINTY_PHRASES = [
    "لا يمكن تحديد",
    "لا يمكن الجزم",
    "لا يمكن التاكد",
    "غير واضح",
    "غير كافي",
    "غير كاف",
    "معلومات غير كافيه",
    "بدون تفاصيل",
    "من دون تفاصيل",
    "نحتاج تفاصيل",
    "نحتاج معلومات",
    "احتاج تفاصيل",
    "يرجي توضيح",
    "يرجي ذكر",
]


def _normalize(text: str) -> str:
    text = (text or "").strip()
    text = ARABIC_DIACRITICS.sub("", text)
    text = (
        text.replace("أ", "ا")
        .replace("إ", "ا")
        .replace("آ", "ا")
        .replace("ى", "ي")
        .replace("ؤ", "و")
        .replace("ئ", "ي")
        .replace("ة", "ه")
        .lower()
    )
    text = re.sub(r"[^\w\s\u0600-\u06FF]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _is_greeting_only(text: str) -> bool:
    return (text or "").strip() in GREETINGS


def _is_short_followup(text: str) -> bool:
    t = (text or "").strip()
    if len(t) <= 18:
        return True
    tokens = _normalize(t).split()
    return len(tokens) <= 4


def _is_explain_request(text: str) -> bool:
    n = _normalize(text)
    if "اشرح" in n or "فسر" in n:
        if "حاله" in n or "النتيجه" in n or "الصوره" in n or "ارسلتها" in n:
            return True
    return False


def _dental_like(text: str, session: Dict) -> bool:
    # استخدم منطق QA للكشف أولاً
    if is_probably_dental(text):
        return True

    n = _normalize(text)

    if re.search(r"(?:^|\s)(?:بال)?ض[ر]?[سص](?:\s|$)", n):
        return True

    return any(
        x in n
        for x in [
            "سن",
            "اسنان",
            "سناني",
            "سنيه",
            "لثه",
            "فك",
            "مفصل",
            "عصب",
            "حشوه",
            "تسوس",
            "لمعه",
            "جير",
            "خراج",
            "تورم",
        ]
    )


async def _get_session(session_id: Optional[str]) -> Tuple[str, Dict]:
    if store is None:
        raise RuntimeError("Session store is not initialized (SQLite).")

    if not session_id:
        sid = str(uuid.uuid4())
        payload = new_session_payload()
        await store.set(sid, payload)
        return sid, payload

    data = await store.get(session_id)
    if not data:
        sid = str(uuid.uuid4())
        payload = new_session_payload()
        await store.set(sid, payload)
        return sid, payload

    return session_id, data


def detect_emergency_user(text: str) -> EmergencyInfo:
    t = _normalize(text)
    red_flag_terms = [
        "صعوبه تنفس", "ضيق تنفس", "اختناق",
        "صعوبه بلع", "ما عم اقدر بلع",
        "تورم سريع", "انتفاخ سريع",
        "تورم الوجه", "انتفاخ الوجه", "تورم بالوجه",
        "انتشار التورم", "تورم منتشر",
        "حراره", "حمى", "قشعريره",
    ]
    found = [term for term in red_flag_terms if term in t]
    if not found:
        return EmergencyInfo(red_flags=[], advice=None)

    advice = "هذه علامات خطرة. يُنصح بمراجعة الطوارئ فوراً."
    return EmergencyInfo(red_flags=found, advice=advice)


SPECIALTIES = ["ترميمية", "لبية", "لثوية", "تعويضات ثابتة", "تعويضات متحركة", "أسنان أطفال"]


def parse_specialty(answer: str) -> Optional[str]:
    if not answer:
        return None

    m = re.search(r"الاختصاص\s+الأنسب.*?:\s*-\s*(.+)", answer)
    if m:
        cand = m.group(1).strip()
        cand = cand.split("،")[0].split(",")[0].strip()
        for sp in SPECIALTIES:
            if sp in cand:
                return sp

    lines = [ln.strip() for ln in answer.splitlines() if ln.strip()]
    for i, ln in enumerate(lines):
        if "الاختصاص" in ln and "الأنسب" in ln:
            for j in range(i + 1, min(i + 5, len(lines))):
                if lines[j].startswith("-"):
                    cand = lines[j].lstrip("-").strip()
                    cand = cand.split("،")[0].split(",")[0].strip()
                    for sp in SPECIALTIES:
                        if sp in cand:
                            return sp
            break

    return None


def format_sources(docs: List) -> List[SourceInfo]:
    formatted: List[SourceInfo] = []
    for doc in docs or []:
        meta = getattr(doc, "metadata", None) or {}
        score = meta.get("score") or meta.get("similarity_score")
        formatted.append(
            SourceInfo(
                source=str(meta.get("source", "unknown")),
                snippet=(getattr(doc, "page_content", "") or "")[:220],
                score=float(score) if score is not None else None,
            )
        )
    return formatted


def _answer_has_uncertainty(answer: str) -> bool:
    if not answer:
        return False
    norm = _normalize(answer)
    return any(phrase in norm for phrase in UNCERTAINTY_PHRASES)


def _answer_needs_followup(answer: str) -> bool:
    if not answer:
        return False
    if _answer_has_uncertainty(answer):
        return True
    if FOLLOWUP_SECTION_RE.search(answer) or NUMBERED_QUESTION_RE.search(answer):
        return True
    if "؟" in answer or "?" in answer:
        return True
    return False

def _strip_followup_section(answer: str) -> str:
    if not answer:
        return ""
    match = FOLLOWUP_SECTION_RE.search(answer)
    if match:
        return answer[: match.start()].rstrip()
    match = NUMBERED_QUESTION_RE.search(answer)
    if match:
        return answer[: match.start()].rstrip()
    return answer


def _dedupe_sources(sources: List[Any]) -> List[SourceInfo]:
    seen: set[tuple[str, str]] = set()
    unique: List[SourceInfo] = []
    for item in sources or []:
        if isinstance(item, SourceInfo):
            data = item.model_dump()
        else:
            data = dict(item or {})
        source = str(data.get("source", "") or "")
        snippet = str(data.get("snippet", "") or "")
        key = (source, snippet)
        if key in seen:
            continue
        seen.add(key)
        unique.append(
            SourceInfo(
                source=source or "unknown",
                snippet=snippet,
                score=data.get("score"),
            )
        )
    return unique


def _normalize_response_payload(payload: ChatResponse | Dict[str, Any]) -> ChatResponse:
    data = payload.model_dump() if isinstance(payload, ChatResponse) else dict(payload or {})

    data.setdefault("session_id", "")
    data.setdefault("state", "need_followup")
    data.setdefault("answer", "")
    data.setdefault("is_emergency", False)
    data.setdefault("emergency", None)
    data.setdefault("triage", TriageInfo().model_dump())
    data.setdefault("follow_up", FollowUpInfo().model_dump())
    data.setdefault("sources", [])

    triage = data.get("triage")
    if isinstance(triage, TriageInfo):
        triage = triage.model_dump()
    else:
        triage = dict(triage or {})
    triage.setdefault("specialty", None)
    triage.setdefault("is_final", False)
    triage.setdefault("confidence", None)

    follow_up = data.get("follow_up")
    if isinstance(follow_up, FollowUpInfo):
        follow_up = follow_up.model_dump()
    else:
        follow_up = dict(follow_up or {})
    follow_up.setdefault("questions", [])
    followup_questions = list(follow_up.get("questions") or [])
    follow_up["questions"] = followup_questions

    data["sources"] = [s.model_dump() for s in _dedupe_sources(data.get("sources") or [])]

    answer = data.get("answer") or ""
    state = str(data.get("state") or "need_followup")
    has_uncertainty = _answer_has_uncertainty(answer)
    has_questions = bool(
        FOLLOWUP_SECTION_RE.search(answer)
        or NUMBERED_QUESTION_RE.search(answer)
        or ("؟" in answer)
        or ("?" in answer)
    )
    has_specialty = bool(triage.get("specialty"))

    if has_specialty and not has_uncertainty:
        triage["is_final"] = True
        data["state"] = "triaged"
        follow_up["questions"] = []
        data["answer"] = _strip_followup_section(answer)
    else:
        needs_followup = has_uncertainty or has_questions or bool(followup_questions)
        if needs_followup:
            triage["is_final"] = False
            if state != "need_age":
                data["state"] = "need_followup"
        elif triage.get("is_final"):
            data["state"] = "triaged"
            follow_up["questions"] = []
            data["answer"] = _strip_followup_section(answer)
        elif data.get("state") == "triaged":
            data["state"] = "need_followup"

    is_emergency = bool(data.get("is_emergency"))
    if is_emergency:
        emergency = data.get("emergency")
        if isinstance(emergency, EmergencyInfo):
            emergency = emergency.model_dump()
        elif emergency is None:
            emergency = EmergencyInfo(red_flags=[], advice=None).model_dump()
        else:
            emergency = dict(emergency or {})
            emergency.setdefault("red_flags", [])
            emergency.setdefault("advice", None)
        data["emergency"] = emergency
    else:
        data["emergency"] = None

    data["triage"] = triage
    data["follow_up"] = follow_up
    return ChatResponse(**data)


def followup_questions_for(state: str) -> List[str]:
    if state == "need_age":
        return ["كم عمرك بالسنوات؟"]
    # حتى non_dental لازم يعطي أسئلة (حسب طلبك)
    if state in {"need_followup", "non_dental"}:
        return [
            "وين المشكلة بالضبط؟ (سن/ضرس/لثة/فك) وعلى أي جهة؟",
            "هل الألم مع البارد/الحار/الحلو؟ وكم مدته بعد المؤثر؟",
            "في تورّم/نزف/قيح أو ألم يوقظك من النوم؟",
        ]
    return []


# ---------- Routes ----------
@app.get("/", response_class=HTMLResponse)
async def root() -> HTMLResponse:
    index_path = os.path.join(static_dir, "index.html")
    if not os.path.isfile(index_path):
        return HTMLResponse("<h3>Dental RAG Assistant is running.</h3>")
    with open(index_path, "r", encoding="utf-8") as f:
        return HTMLResponse(f.read())


@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    session_id, session = await _get_session(request.session_id)

    # store age if provided
    if request.age is not None:
        session["age"] = request.age

    text = (request.message or "").strip()
    if not text:
        return _normalize_response_payload(
            ChatResponse(
                session_id=session_id,
                state="need_followup",
                answer="message is required",
                is_emergency=False,
                emergency=None,
                triage=TriageInfo(specialty=None, is_final=False, confidence=None),
                follow_up=FollowUpInfo(questions=[]),
                sources=[],
            )
        )

    # record user message
    session.setdefault("history", [])
    session["history"].append({"role": "user", "content": text})

    # Need age first
    if session.get("age") is None:
        session["last_state"] = "need_age"
        await store.set(session_id, session)  # type: ignore
        return _normalize_response_payload(
            ChatResponse(
                session_id=session_id,
                state="need_age",
                answer="تمام. قبل ما نكمل، قديش عمرك؟",
                is_emergency=False,
                emergency=EMPTY_EMERGENCY,
                triage=TriageInfo(specialty=None, is_final=False, confidence=None),
                follow_up=FollowUpInfo(questions=followup_questions_for("need_age")),
                sources=[],
            )
        )

    # Greeting: لا تستدعي QA
    if _is_greeting_only(text):
        session["last_state"] = "need_followup"
        await store.set(session_id, session)  # type: ignore
        return _normalize_response_payload(
            ChatResponse(
                session_id=session_id,
                state="need_followup",
                answer="أهلاً! احكيلي شو المشكلة السنية اللي عندك؟",
                is_emergency=False,
                emergency=EMPTY_EMERGENCY,
                triage=TriageInfo(specialty=None, is_final=False, confidence=None),
                follow_up=FollowUpInfo(questions=followup_questions_for("need_followup")),
                sources=[],
            )
        )

    if _is_explain_request(text):
        expl = session.get("last_answer")
        if expl:
            state = "need_followup"
            answer = f"{expl}\n\nاحكيلي كمان شوي لنثبت الاتجاه."
            session["last_state"] = state
            session["history"].append({"role": "assistant", "content": answer})
            session["last_answer"] = answer
            await store.set(session_id, session)  # type: ignore
            return _normalize_response_payload(
                ChatResponse(
                    session_id=session_id,
                    state=state,
                    answer=answer,
                    is_emergency=False,
                    emergency=EMPTY_EMERGENCY,
                    triage=TriageInfo(specialty=None, is_final=False, confidence=None),
                    follow_up=FollowUpInfo(questions=followup_questions_for(state)),
                    sources=[],
                )
            )
        state = "need_followup"
        answer = "أكيد. بس لحتى اشرح صح، احكيلي شو الأعراض؟ (سن/ضرس/لثة/فك) ومحفّز الألم ومدته."
        session["last_state"] = state
        session["history"].append({"role": "assistant", "content": answer})
        session["last_answer"] = answer
        await store.set(session_id, session)  # type: ignore
        return _normalize_response_payload(
            ChatResponse(
                session_id=session_id,
                state=state,
                answer=answer,
                is_emergency=False,
                emergency=EMPTY_EMERGENCY,
                triage=TriageInfo(specialty=None, is_final=False, confidence=None),
                follow_up=FollowUpInfo(questions=followup_questions_for(state)),
                sources=[],
            )
        )

    case_parts: List[str] = session.get("case_parts") or []
    last_state = session.get("last_state")

    if _dental_like(text, session):
        case_parts.append(text)
    else:
        if case_parts and last_state in {"need_followup", "non_dental", "triaged"} and _is_short_followup(text):
            case_parts.append(text)
        else:
            case_parts = []  

    case_parts = case_parts[-8:]
    session["case_parts"] = case_parts

    if not case_parts and not _dental_like(text, session):
        state = "non_dental"
        answer = (
            "أهلاً! فيني ساعدك، بس دوري الأساسي هو فرز حالات الأسنان. "
            "إذا عندك مشكلة سنية احكيلي عنها (ألم/حساسية/لثة/فك/تعويضات)."
        )
        session["last_state"] = state
        session["history"].append({"role": "assistant", "content": answer})
        session["last_answer"] = answer
        await store.set(session_id, session)
        return _normalize_response_payload(
            ChatResponse(
                session_id=session_id,
                state=state,
                answer=answer,
                is_emergency=False,
                emergency=EMPTY_EMERGENCY,
                triage=TriageInfo(specialty=None, is_final=False, confidence=None),
                follow_up=FollowUpInfo(questions=followup_questions_for(state)),
                sources=[],
            )
        )

    merged_text = " ".join(case_parts) if case_parts else text
    age_prefix = f"عمر المريض: {session['age']}.\n"
    query = age_prefix + "وصف الحالة: " + merged_text


    try:
        result = qa.invoke({"query": query, "age": session["age"]})
    except Exception as exc:
        return _normalize_response_payload(
            ChatResponse(
                session_id=session_id,
                state="need_followup",
                answer=str(exc),
                is_emergency=False,
                emergency=None,
                triage=TriageInfo(specialty=None, is_final=False, confidence=None),
                follow_up=FollowUpInfo(questions=[]),
                sources=[],
            )
        )

    if isinstance(result, dict):
        answer = result.get("result", "") or result.get("answer", "") or ""
        docs = result.get("source_documents", []) or []
    else:
        answer = str(result or "")
        docs = []

    specialty = parse_specialty(answer)
    state = "triaged" if specialty else "need_followup"
    sources = format_sources(docs)

    em_user = detect_emergency_user(merged_text)
    is_emergency = bool(em_user.red_flags)
    emergency_obj = em_user if is_emergency else None

    triage = TriageInfo(
        specialty=specialty if state == "triaged" else None,
        is_final=True if state == "triaged" else False,
        confidence=None,  
    )

    fu = [] if (state == "triaged" and triage.is_final) else followup_questions_for(state)

    response = _normalize_response_payload(
        ChatResponse(
            session_id=session_id,
            state=state,
            answer=answer,
            is_emergency=is_emergency,
            emergency=emergency_obj,
            triage=triage,
            follow_up=FollowUpInfo(questions=fu),
            sources=sources,
        )
    )

    session["history"].append({"role": "assistant", "content": response.answer})
    session["last_state"] = response.state
    session["last_triage"] = response.triage.model_dump()
    session["last_answer"] = response.answer
    await store.set(session_id, session)  # type: ignore
    return response
