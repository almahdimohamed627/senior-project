# web_app.py
import os
import re
import sys
import uuid
from typing import Dict, List, Optional, Tuple

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from dotenv import load_dotenv

from rag.vectorstore import get_or_create_vectorstore
from rag.qa import create_qa_chain, is_probably_dental
from rag.session_store_sqlite import SQLiteSessionStore, new_session_payload

load_dotenv()

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")


# ---------- Schemas ----------
class ImageAIResult(BaseModel):
    prediction: str = Field(..., description="calculus|caries|hypodontia")
    confidence: Optional[float] = Field(None, description="0..1")
    status: Optional[str] = Field(None, description="disease_detected|no_disease|...")


class ChatRequest(BaseModel):
    message: str = Field(..., description="User message")
    age: Optional[int] = Field(None, description="Patient age")
    session_id: Optional[str] = Field(None, description="Session identifier")
    image_ai: Optional[ImageAIResult] = Field(None, description="Optional image-model result")


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


# ---------- Helpers ----------
GREETINGS = {"مرحبا", "اهلا", "أهلا", "هاي", "السلام عليكم", "سلام", "hello", "hi", "كيفك", "شلونك", "كيف الحال"}
ARABIC_DIACRITICS = re.compile(r"[\u0617-\u061A\u064B-\u0652\u0670\u0640]")


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
    # إذا عندنا image_ai مرض مكتشف → اعتبر المحادثة سنية حتى لو المستخدم كتب "اشرح الحالة"
    img = session.get("image_ai") or {}
    status = (img.get("status") or "").lower()
    if status in {"disease_detected", "detected", "positive"}:
        return True

    # استخدم منطق QA للكشف أولاً
    if is_probably_dental(text):
        return True

    n = _normalize(text)

    # التقط أخطاء شائعة: ضرس/ضرص + أشكال مثل "بضرص" / "بالضرس"
    if re.search(r"(?:^|\s)(?:بال)?ض[ر]?[سص](?:\s|$)", n):
        return True

    # كلمات أسنان عامة
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
        # إذا السشن مش موجودة، ننشئ واحدة جديدة (ونرجع session_id جديد)
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
        "تورم", "انتفاخ",
        "حراره", "حمى", "قشعريره",
        "قيح", "خراج",
        "الم ليلي", "يوقظ من النوم",
    ]
    found = [term for term in red_flag_terms if term in t]
    if not found:
        return EmergencyInfo(red_flags=[], advice=None)

    if any(x in t for x in ["صعوبه تنفس", "ضيق تنفس", "اختناق", "صعوبه بلع", "ما عم اقدر بلع"]):
        advice = "هذه علامات خطرة. يُنصح بمراجعة الطوارئ فوراً."
    else:
        advice = "يُنصح بزيارة طبيب الأسنان بشكل عاجل."
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


def image_ai_hint(session: Dict) -> Optional[str]:
    img = session.get("image_ai")
    if not img:
        return None

    pred = (img.get("prediction") or "").strip().lower()
    conf = img.get("confidence")
    status = (img.get("status") or "").strip().lower()

    if status and status not in {"disease_detected", "detected", "positive"}:
        return f"نتيجة نموذج الصورة: status={status}."

    conf_txt = ""
    if isinstance(conf, (int, float)):
        conf_txt = f" (ثقة تقريباً {float(conf):.2f})"

    if pred == "caries":
        return f"نموذج الصورة رجّح تسوّس (caries){conf_txt}."
    if pred == "calculus":
        return f"نموذج الصورة رجّح جير/ترسّبات (calculus){conf_txt}."
    if pred == "hypodontia":
        return f"نموذج الصورة رجّح نقص/فقد أسنان (hypodontia){conf_txt}."
    return f"نتيجة نموذج الصورة: prediction={pred}{conf_txt}."


def explain_from_image_ai(session: Dict) -> Optional[str]:
    img = session.get("image_ai") or {}
    pred = (img.get("prediction") or "").strip().lower()
    if not pred:
        return None

    base = image_ai_hint(session) or "وصلتني نتيجة نموذج الصورة."
    if pred == "calculus":
        return (
            f"{base}\n"
            "الـ calculus غالباً يعني ترسّبات/جير حول الأسنان واللثة، وهاد يرتبط كثيراً بالتهاب اللثة ونزف ورائحة.\n"
            "التوجيه الأولي غالباً: **لثوية** (تنظيف + تقييم لثة)."
        )
    if pred == "caries":
        return (
            f"{base}\n"
            "الـ caries يعني تسوّس. التوجيه الأولي غالباً: **ترميمية** (حشوة) "
            "وإذا الألم طويل/ليلي ممكن نحتاج **لبية**."
        )
    if pred == "hypodontia":
        return (
            f"{base}\n"
            "الـ hypodontia يعني نقص/غياب أسنان. التوجيه الأولي غالباً: **تعويضات** "
            "(ثابتة/متحركة حسب الحالة) ومع العمر ممكن يكون **أسنان أطفال** إذا المريض صغير."
        )
    return f"{base}"


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
        raise HTTPException(status_code=400, detail="message is required")

    # store image_ai if provided
    if request.image_ai is not None:
        session["image_ai"] = request.image_ai.model_dump()

    # record user message
    session.setdefault("history", [])
    session["history"].append({"role": "user", "content": text})

    # Need age first
    if session.get("age") is None:
        session["last_state"] = "need_age"
        await store.set(session_id, session)  # type: ignore
        return ChatResponse(
            session_id=session_id,
            state="need_age",
            answer="تمام. قبل ما نكمل، قديش عمرك؟",
            is_emergency=False,
            emergency=None,
            triage=TriageInfo(specialty=None, is_final=False, confidence=None),
            follow_up=FollowUpInfo(questions=followup_questions_for("need_age")),
            sources=[],
        )

    # Greeting: لا تستدعي QA
    if _is_greeting_only(text):
        session["last_state"] = "need_followup"
        await store.set(session_id, session)  # type: ignore
        return ChatResponse(
            session_id=session_id,
            state="need_followup",
            answer="أهلاً! احكيلي شو المشكلة السنية اللي عندك؟",
            is_emergency=False,
            emergency=None,
            triage=TriageInfo(specialty=None, is_final=False, confidence=None),
            follow_up=FollowUpInfo(questions=followup_questions_for("need_followup")),
            sources=[],
        )

    # إذا المستخدم قال "اشرح الحالة..." وفي عنا image_ai أو جواب سابق → جاوب بشرح سريع + أسئلة
    if _is_explain_request(text):
        expl = explain_from_image_ai(session) or session.get("last_answer")
        if expl:
            state = "need_followup"
            answer = f"{expl}\n\nاحكيلي كمان شوي لنثبت الاتجاه."
            session["last_state"] = state
            session["history"].append({"role": "assistant", "content": answer})
            session["last_answer"] = answer
            await store.set(session_id, session)  # type: ignore
            return ChatResponse(
                session_id=session_id,
                state=state,
                answer=answer,
                is_emergency=False,
                emergency=None,
                triage=TriageInfo(specialty=None, is_final=False, confidence=None),
                follow_up=FollowUpInfo(questions=followup_questions_for(state)),
                sources=[],
            )
        # ما في شيء مخزن → اطلب تفاصيل
        state = "need_followup"
        answer = "أكيد. بس لحتى اشرح صح، احكيلي شو الأعراض؟ (سن/ضرس/لثة/فك) ومحفّز الألم ومدته."
        session["last_state"] = state
        session["history"].append({"role": "assistant", "content": answer})
        session["last_answer"] = answer
        await store.set(session_id, session)  # type: ignore
        return ChatResponse(
            session_id=session_id,
            state=state,
            answer=answer,
            is_emergency=False,
            emergency=None,
            triage=TriageInfo(specialty=None, is_final=False, confidence=None),
            follow_up=FollowUpInfo(questions=followup_questions_for(state)),
            sources=[],
        )

    # ---- Case continuity ----
    case_parts: List[str] = session.get("case_parts") or []
    last_state = session.get("last_state")

    # ثبت hint تبع الصورة مرة وحدة داخل السياق
    img_hint = image_ai_hint(session)
    if img_hint:
        marker = f"[ImageAI] {img_hint}"
        if marker not in case_parts:
            case_parts.insert(0, marker)

    if _dental_like(text, session):
        case_parts.append(text)
    else:
        # إذا عم يجاوب متابعة قصيرة وكان في سياق مفتوح
        if case_parts and last_state in {"need_followup", "non_dental", "triaged"} and _is_short_followup(text):
            case_parts.append(text)
        else:
            case_parts = []  # ما في سياق سنّي

    # قصّ لآخر 8 أجزاء
    case_parts = case_parts[-8:]
    session["case_parts"] = case_parts

    # إذا غير سني وما في سياق → non_dental بدون QA
    if not case_parts and not _dental_like(text, session):
        state = "non_dental"
        answer = (
            "أهلاً! فيني ساعدك، بس دوري الأساسي هو فرز حالات الأسنان. "
            "إذا عندك مشكلة سنية احكيلي عنها (ألم/حساسية/لثة/فك/تعويضات)."
        )
        session["last_state"] = state
        session["history"].append({"role": "assistant", "content": answer})
        session["last_answer"] = answer
        await store.set(session_id, session)  # type: ignore
        return ChatResponse(
            session_id=session_id,
            state=state,
            answer=answer,
            is_emergency=False,
            emergency=None,
            triage=TriageInfo(specialty=None, is_final=False, confidence=None),
            follow_up=FollowUpInfo(questions=followup_questions_for(state)),
            sources=[],
        )

    merged_text = " ".join(case_parts) if case_parts else text
    age_prefix = f"عمر المريض: {session['age']}.\n"
    query = age_prefix + "وصف الحالة: " + merged_text

    # DEBUG: لتعرف إذا Groq/QA عم ينضرب
    # print("CALLING QA:", query)

    try:
        result = qa.invoke({"query": query, "age": session["age"]})
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    if isinstance(result, dict):
        answer = result.get("result", "") or result.get("answer", "") or ""
        docs = result.get("source_documents", []) or []
    else:
        answer = str(result or "")
        docs = []

    specialty = parse_specialty(answer)
    state = "triaged" if specialty else "need_followup"
    sources = format_sources(docs)

    # emergency من وصف المستخدم فقط (مو من أسئلة المودل)
    em_user = detect_emergency_user(merged_text)
    is_emergency = bool(em_user.red_flags)
    emergency_obj = em_user if is_emergency else None

    triage = TriageInfo(
        specialty=specialty if state == "triaged" else None,
        is_final=True if state == "triaged" else False,
        confidence=None,  # بدون hardcode
    )

    # follow_up: فاضي فقط إذا triaged نهائي
    fu = [] if (state == "triaged" and triage.is_final) else followup_questions_for(state)

    response = ChatResponse(
        session_id=session_id,
        state=state,
        answer=answer,
        is_emergency=is_emergency,
        emergency=emergency_obj,
        triage=triage,
        follow_up=FollowUpInfo(questions=fu),
        sources=sources,
    )

    session["history"].append({"role": "assistant", "content": response.answer})
    session["last_state"] = response.state
    session["last_triage"] = response.triage.model_dump()
    session["last_answer"] = response.answer
    await store.set(session_id, session)  # type: ignore
    return response
