"""
QA chain logic: detects if query is dental, routes children, asks for triggers,
and uses LangChain (LLM + Chroma retriever) to triage to the closest specialty.
Optionally uses Tavily web-search fallback ONLY when retrieval yields no docs/empty context.
"""

import os
import re
from typing import List

from langchain_core.documents import Document
from langchain_ollama import OllamaLLM
from langchain_groq import ChatGroq
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import PromptTemplate
from langchain_core.runnables import RunnableLambda
from langchain_chroma import Chroma

from .reranker import rerank
from .web_search import tavily_search_documents


ARABIC_DIACRITICS = re.compile(r"[\u0617-\u061A\u064B-\u0652\u0670\u0640]")


def _normalize(text: str) -> str:
    """Normalize Arabic text for robust keyword detection."""
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


def _strip_al(token: str) -> str:
    """Remove Arabic definite article 'ال' prefix for matching."""
    token = (token or "").strip()
    if token.startswith("ال") and len(token) > 2:
        return token[2:]
    return token


def _token_variants(token: str) -> set[str]:
    """Return common Arabic clitic variants (ال/بال/ب) for matching."""
    t = (token or "").strip()
    out = {t, _strip_al(t)}
    if t.startswith("بال") and len(t) > 3:
        out.add(t[3:])
        out.add(_strip_al(t[3:]))
    if t.startswith("ب") and len(t) > 1:
        out.add(t[1:])
        out.add(_strip_al(t[1:]))
    return {x for x in out if x}


DENTAL_TOKEN_KEYWORDS = {
    # Dental / teeth
    "سن",
    "سني",
    "اسنان",
    "ضرس",
    "اضراس",
    "لثه",
    "اللثه",
    "تسوس",
    "نخر",
    "طقم",
    "جسر",
    "تلبيس",
    "تاج",
    "حشوه",
    "عصب",
    "خراج",
    "تورم",
    "حساسيه",
    "حساس",
    "لمعه",
    # TMJ / orofacial pain
    "فك",
    "الفك",
    "مفصل",
    "طقطقه",
    "صرير",
    "طحن",
    "شد",
    "تشنج",
    "مضغ",
    "عض",
    "قفل",
    "صداع",
    "صدغ",

    "سنيه",
    "اسناني",
    "ضرص",
    "ضروسي",}

DENTAL_PHRASE_KEYWORDS = {
    "ضرس العقل",
    "وجع سن",
    "الم سن",
    "الم ضرس",
    "تورم بالوجه",
    "مفصل الفك",
    "الم الفك",
    "فتح الفم",
    "طقطقه الفك",
    "صرير الاسنان",
    "طحن الاسنان",

    "ضرص العقل",}

TRIGGER_TOKEN_KEYWORDS = {
    "بارد",
    "بارده",
    "برد",
    "حلو",
    "حلوه",
    "حار",
    "حامي",
    "حراره",
    "سخن",
    "ساخن",
    "ساخنه",
    "عفوي",
    "عفويه",
    "بدون",
    "دون",
    "سبب",

    "البارد",
    "الحار",
    "الحلو",}

TRIGGER_PHRASES = {
    "بدون سبب",
    "دون سبب",
    "من دون سبب",
}

CHILD_PHRASES = {
    "طفل",
    "طفله",
    "ابني",
    "بني",
    "ابني عمره",
    "بنتي",
    "طفلتي",
    "ولدي",
}


def get_llm(backend: str = "groq"):
    """
    Return the configured LLM client; groq is default backend.
    Switch via env DENTAL_LLM_BACKEND=groq|ollama (defaults to groq).
    """
    backend = (backend or "groq").lower()

    if backend == "groq":
        api_key = os.getenv("GROQ_API_KEY", "").strip()
        if not api_key:
            raise ValueError("GROQ_API_KEY is not set in environment")

        model_name = os.getenv("GROQ_MODEL", "llama-3.1-70b-versatile")

        return ChatGroq(
            api_key=api_key,
            model_name=model_name,
            temperature=0.0,
        )

    if backend == "ollama":
        ollama_model = os.getenv("OLLAMA_LLM_MODEL", "llama3.1")
        return OllamaLLM(
            model=ollama_model,
            temperature=0.0,
        )

    raise ValueError(f"Unsupported LLM backend: {backend}")


def is_probably_dental(text: str) -> bool:
    """Detect if a message is likely dental-related (including TMJ/Bruxism)."""
    norm = _normalize(text)
    toks: set[str] = set()
    for t in norm.split():
        toks |= _token_variants(t)

    if toks & DENTAL_TOKEN_KEYWORDS:
        return True
    if any(p in norm for p in DENTAL_PHRASE_KEYWORDS):
        return True

    # Trigger words alone may still indicate dental sensitivity context
    if toks & TRIGGER_TOKEN_KEYWORDS:
        return True
    if any(p in norm for p in TRIGGER_PHRASES):
        return True

    return False


def _has_trigger(text: str) -> bool:
    norm = _normalize(text)
    toks: set[str] = set()
    for t in norm.split():
        toks |= _token_variants(t)
    if toks & TRIGGER_TOKEN_KEYWORDS:
        return True
    return any(p in norm for p in TRIGGER_PHRASES)


def _is_child(text: str) -> bool:
    norm = _normalize(text)
    return any(p in norm for p in CHILD_PHRASES)


def create_qa_chain(vectordb: Chroma, backend: str = "groq") -> RunnableLambda:
    rerank_enabled = (os.getenv("DENTAL_USE_RERANKER", "false") or "false").lower() in {
        "1",
        "true",
        "yes",
    }
    rerank_candidates = int(os.getenv("DENTAL_RERANK_CANDIDATES", "8"))
    rerank_topk = int(os.getenv("DENTAL_RERANK_TOPK", "4"))
    rerank_model = os.getenv(
        "DENTAL_RERANK_MODEL", "Omartificial-Intelligence-Space/ARA-Reranker-V1"
    )
    if rerank_enabled:
        print(f"🔁 Reranker enabled: {rerank_model}")

    web_fallback_enabled = (os.getenv("DENTAL_USE_WEB_FALLBACK", "false") or "false").lower() in {
        "1",
        "true",
        "yes",
    }

    retriever = vectordb.as_retriever(
        search_type="similarity_score_threshold",
        search_kwargs={"k": rerank_candidates, "score_threshold": 0.4},
    )

    llm = get_llm(backend=backend)
    parser = StrOutputParser()

    rewrite_prompt = PromptTemplate(
        template=(
            "أنت مساعد لإعادة صياغة شكوى مريض في مجال طب الأسنان.\n"
            "حوّل النص التالي إلى وصف طبي مختصر وواضح، "
            "بدون إضافة أعراض جديدة غير مذكورة، وبدون تغيير المعنى.\n\n"
            "شكوى المريض:\n{question}\n\n"
            "الوصف الطبي المختصر:"
        ),
        input_variables=["question"],
    )
    rewrite_chain = rewrite_prompt | llm | parser

    triage_prompt = PromptTemplate(
        template=(
            "أنت مساعد فرز (triage) تفاعلي في طب الأسنان.\n"
            "مهمتك قراءة شكوى المريض واستخدام السياق الطبي المرفق لتحديد أقرب اختصاص أسنان للبالغين "
            "(ترميمية/لبية/لثوية/تعويضات ثابتة/تعويضات متحركة)، "
            "وطرح أسئلة متابعة محددة إذا كانت المعلومات ناقصة.\n\n"
            "قواعد الأطفال:\n"
            "- إذا كان عمر المريض أقل من 13 سنة أو كان واضحاً أنه طفل → حول مباشرة إلى أسنان أطفال "
            "ولا تستعرض اختصاصات البالغين.\n\n"
            "الاختصاصات المتاحة للبالغين فقط:\n"
            "- ترميمية\n"
            "- لبية\n"
            "- لثوية\n"
            "- تعويضات ثابتة\n"
            "- تعويضات متحركة\n\n"
            "قواعد خاصة بالعمر:\n"
            "- إذا كان عمر المريض أقل من 13 سنة أو كان واضحاً أنه طفل، فالاختصاص: أسنان أطفال (تحويل).\n"
            "- إذا لم يُذكر العمر، حلّل الأعراض فقط بدون اختراع عمر.\n\n"
            "إرشادات سريعة للتمييز بين الحالات:\n"
            "- حساسية/ترميمية: لمعة أو ألم خفيف/حاد قصير جداً مع البارد أو الحار أو الحلو أو الحامض، "
            "يختفي فور إزالة المؤثّر، بدون ألم تلقائي وبدون ألم يوقظ المريض من النوم → يرجّح اختصاص ترميمية "
            "(أو مع لثوية إذا كان السبب انحسار لثة أو تعرّي عنق السن).\n"
            "- حالة لبيّة غير عكوسة: ألم قوي أو نابض مع البارد أو الحار يستمر بعد إزالة المؤثّر، أو ألم تلقائي "
            "يوقظ المريض من النوم، أو ألم شديد عند القرع أو المضغ، أو وجود تورّم/خراج → يرجّح اختصاص لبية.\n\n"
            "التعليمات المهمة:\n"
            "- اعتمد فقط على المعلومات الموجودة في السياق وعلى شكوى المريض.\n"
            "- لا تستخدم معلومات من خارج السياق إلا كمعرفة عامة بسيطة.\n"
            "- لا تفترض محفّزاً أو مدة أو شدة إذا لم تُذكر صراحة.\n"
            "- إذا كانت المعلومات ناقصة فلا تحسم الاختصاص مباشرة؛ قدّم ترجيحاً مشروطاً واضحاً.\n"
            "- في النهاية اختر اختصاصاً واحداً للبالغين، مع ذكر الشرط الذي يغيّر الاختصاص إذا لزم.\n"
            "- إذا كانت الأعراض غير واضحة تماماً، أعطِ أفضل تخمين مؤقت مع السبب، واطرح 2-3 أسئلة متابعة محددة.\n"
            "- نبرة ودودة ومباشرة، ردّ مختصر ثم الأسئلة.\n\n"
            "السياق الطبي (من قاعدة المعرفة):\n{context}\n\n"
            "شكوى المريض أو سؤاله:\n{question}\n\n"
            "أعطِ الإجابة بالتنسيق التالي:\n"
            "الرد المختصر:\n"
            "- ...\n\n"
            "الاختصاص الأنسب (للبالغين فقط، ومشروط إذا لزم):\n"
            "- ...\n\n"
            "أسئلة متابعة سريعة (إذا كان هناك غموض):\n"
            "- ...\n"
            "- ...\n"
            "- ..."
        ),
        input_variables=["context", "question"],
    )

    web_triage_prompt = PromptTemplate(
        template=(
            "ملاحظة: السياق التالي مقتطفات ويب عامة وليست تشخيصاً.\n"
            "أنت مساعد فرز أولي في طب الأسنان.\n\n"
            "اختر اختصاصاً واحداً فقط من:\n"
            "- ترميمية\n"
            "- لبية\n"
            "- لثوية\n"
            "- تعويضات ثابتة\n"
            "- تعويضات متحركة\n\n"
            "إذا كانت المعلومات غير كافية، اسأل 2-3 أسئلة متابعة محددة بدون اختيار نهائي.\n"
            "لا تخترع حقائق غير موجودة في الشكوى أو المقتطفات.\n\n"
            "السياق:\n{context}\n\n"
            "الشكوى:\n{question}\n\n"
            "الرد:"
        ),
        input_variables=["context", "question"],
    )

    general_prompt = PromptTemplate(
        template=(
            "المستخدم كتب الرسالة التالية (قد لا تكون عن الأسنان):\n\n"
            "{question}\n\n"
            "ردّ عليه بأسلوب ودود وبسيط بجملة أو جملتين، "
            "ثم أوضح له أن دورك الأساسي هو مساعد تكنولوجي لفرز حالات الأسنان "
            "(ألم الأسنان، الحساسية، مشاكل اللثة، التعويضات الثابتة والمتحركة، أسنان الأطفال). "
            "في النهاية اطلب منه أن يصف لك أي مشكلة سنية لو كانت موجودة."
        ),
        input_variables=["question"],
    )

    triage_chain = triage_prompt | llm | parser
    web_triage_chain = web_triage_prompt | llm | parser
    general_chain = general_prompt | llm | parser

    def _run(inputs: dict) -> dict:
        question = inputs.get("query") or inputs.get("question")
        age = inputs.get("age")
        if not question:
            raise ValueError("query/question is required")

        # 1) Non-dental route
        if not is_probably_dental(question):
            answer = general_chain.invoke({"question": question})
            return {"result": answer, "source_documents": []}

        # 2) Child route
        if (age is not None and age < 13) or _is_child(question):
            child_msg = (
                "يُحوَّل مباشرة إلى اختصاص أسنان أطفال "
                + (f"(العمر: {age} سنة). " if age is not None else "")
                + "يرجى المتابعة مع طبيب أسنان أطفال."
            )
            return {"result": child_msg.strip(), "source_documents": []}

        # 3) "لمعة" needs trigger clarification
        norm_q = _normalize(question)
        if ("لمعه" in norm_q.split() or "لمعة" in question) and not _has_trigger(question):
            ask_trigger = (
                "أهلاً! لنحدد الاختصاص بدقة لازم أعرف محفّز اللمعة:\n"
                "- هل تأتي مع البارد؟\n"
                "- مع الحلو؟\n"
                "- مع الحار/السخن؟\n"
                "- أم بدون سبب واضح (عفوية)؟\n"
                "أخبرني أيضاً عن مدة الألم بعد المحفّز."
            )
            return {"result": ask_trigger, "source_documents": []}

        # 4) Rewrite -> retrieve
        rewritten = rewrite_chain.invoke({"question": question})
        docs = retriever.invoke(rewritten)

        # 5) Optional rerank
        if rerank_enabled and docs:
            before = len(docs)
            docs = rerank(question, docs, top_k=rerank_topk)
            print(f"🔁 Reranked docs: before={before}, after={len(docs)}")

        context = "\n\n".join(doc.page_content for doc in docs)

        # 6) Optional web fallback ONLY when Chroma retrieval is empty
        if web_fallback_enabled and (not docs or not context.strip()):
            web_docs: List[Document] = tavily_search_documents(question)
            if web_docs:
                web_context_parts: List[str] = []
                for i, doc in enumerate(web_docs, start=1):
                    title = doc.metadata.get("title") or "بدون عنوان"
                    source = doc.metadata.get("source", "unknown")
                    snippet = (doc.page_content or "").strip()
                    web_context_parts.append(
                        f"[{i}] {title}\n{snippet}\nالمصدر: {source}"
                    )
                web_context = "\n\n".join(web_context_parts)
                answer = web_triage_chain.invoke({"context": web_context, "question": question})
                return {"result": answer, "source_documents": web_docs}

        # 7) No docs fallback (local)
        if not docs or not context.strip():
            fallback = (
                "أهلاً! أنا مساعد فرز لحالات الأسنان. "
                "حاول توصفلي أكثر: أين مكان الألم بالضبط؟ منذ متى بدأ؟ "
                "هل يزداد مع البارد أو الحار أو عند العض؟ وهل يوجد تورّم أو نزف أو حرارة عامة؟"
            )
            return {"result": fallback, "source_documents": []}

        # 8) Normal RAG triage
        answer = triage_chain.invoke({"context": context, "question": question})
        return {"result": answer, "source_documents": docs}

    return RunnableLambda(_run)
