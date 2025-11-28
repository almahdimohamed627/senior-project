from langchain_ollama import OllamaLLM
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import PromptTemplate
from langchain_core.runnables import RunnableLambda
from langchain_chroma import Chroma

LLM_MODEL_NAME = "llama3.1"

DENTAL_KEYWORDS = [
    "سن",
    "سني",
    "اسنان",
    "أسنان",
    "ضرس",
    "أضراس",
    "ضرس العقل",
    "لثة",
    "اللثة",
    "تسوس",
    "نخر",
    "طقم",
    "جسر",
    "تلبيس",
    "تاج",
    "حشوة",
    "عصب",
    "وجع سن",
    "ألم سن",
    "ألم ضرس",
    "خراج",
    "تورم بالوجه",
    "حساسية",
    "حساس",
    "لمعة",
]

TRIGGER_KEYWORDS = [
    "بارد",
    "باردة",
    "برد",
    "حلو",
    "حلوة",
    "حار",
    "حامي",
    "حرارة",
    "سخن",
    "ساخن",
    "ساخنة",
    "بدون سبب",
    "دون سبب",
    "من دون سبب",
    "عفوي",
    "عفوية",
]

CHILD_KEYWORDS = [
    "طفل",
    "طفلة",
    "ابني",
    "بني",
    "ابني عمره",
    "بنتي",
    "طفلتي",
    "ولدي",
]


def _normalize(text: str) -> str:
    return (
        text.replace("أ", "ا")
        .replace("إ", "ا")
        .replace("آ", "ا")
        .lower()
    )


def is_probably_dental(text: str) -> bool:
    norm = _normalize(text)
    return any(kw in norm for kw in DENTAL_KEYWORDS) or any(
        t in norm for t in TRIGGER_KEYWORDS
    )


def _has_trigger(text: str) -> bool:
    norm = _normalize(text)
    return any(t in norm for t in TRIGGER_KEYWORDS)


def _is_child(text: str) -> bool:
    norm = _normalize(text)
    return any(k in norm for k in CHILD_KEYWORDS)


def create_qa_chain(vectordb: Chroma) -> RunnableLambda:
    retriever = vectordb.as_retriever(
        search_type="similarity_score_threshold",
        search_kwargs={"k": 8, "score_threshold": 0.4},
    )

    llm = OllamaLLM(
        model=LLM_MODEL_NAME,
        temperature=0.0,
    )
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
            "- لا تفترض محفّزاً أو مدة أو شدة إذا لم تُذكر صراحة. إذا كانت الشكوى عامة مثل 'عندي لمعة'، صرّح أن المحفّز/المدة غير مذكورين.\n"
            "- إذا كانت المعلومات ناقصة فلا تحسم الاختصاص مباشرة؛ قدّم ترجيحاً مشروطاً واضحاً "
            "(مثلاً: ترميمية إذا اللمعة قصيرة مع البارد/الحلو؛ لبية إذا مع الحار أو مستمرة/توقظ من النوم؛ لثوية إذا بدون محفّز ومع انحسار لثة).\n"
            "- في النهاية اختر اختصاصاً واحداً للبالغين، مع ذكر الشرط الذي يغيّر الاختصاص إذا لزم.\n"
            "- إذا كانت الأعراض غير واضحة تماماً، أعطِ أفضل تخمين مؤقت مع السبب، واطرح 2-3 أسئلة متابعة محددة "
            "(مثل: مكان الألم، مدته، هل هناك تورم/نزف، هل الألم مع البارد/الحار/العضّ).\n"
            "- نبرة ودودة ومباشرة، ردّ مختصر ثم الأسئلة.\n\n"
            "تعليمات حول صياغة الجواب:\n"
            "- لا تعِد كتابة شكوى المريض ولا تغيّر تفاصيلها، ولا تضف أمثلة جديدة من عندك.\n"
            "- لا تذكر في الجواب أن الألم يختفي أو يستمر إلا إذا ذُكر ذلك صراحة في الشكوى.\n"
            "- إذا كانت الشكوى قصيرة جداً أو عامة، صرّح بقلة المعلومات واذكر الشروط التي تحدد الاختصاص، واطلب المحفّز (بارد/حلو/حار/عفوي) والمدة بدقة.\n\n"
            "السياق الطبي (من قاعدة المعرفة):\n{context}\n\n"
            "شكوى المريض أو سؤاله:\n{question}\n\n"
            "أعطِ الإجابة بالتنسيق التالي:\n"
            "الرد المختصر:\n"
            "- جملة أو اثنتان تلخّصان الحالة بأقرب اختصاص محتمل مع ذكر الشروط بوضوح.\n\n"
            "الاختصاص الأنسب (للبالغين فقط، ومشروط إذا لزم):\n"
            "- واحد فقط من: ترميمية / لبية / لثوية / تعويضات ثابتة / تعويضات متحركة، "
            "مع ذكر الشرط الذي يغيّر الاختصاص إن وجد. إذا المريض طفل (<13 أو واضح طفل) فالاختصاص: أسنان أطفال (تحويل).\n\n"
            "أسئلة متابعة سريعة (إذا كان هناك غموض):\n"
            "- سؤال 1\n"
            "- سؤال 2\n"
            "- سؤال 3"
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
    general_chain = general_prompt | llm | parser

    def _run(inputs: dict) -> dict:
        question = inputs.get("query") or inputs.get("question")
        age = inputs.get("age")
        if not question:
            raise ValueError("query/question is required")

        if not is_probably_dental(question):
            answer = general_chain.invoke({"question": question})
            return {"result": answer, "source_documents": []}

        if (age is not None and age < 13) or _is_child(question):
            child_msg = (
                "يُحوَّل مباشرة إلى اختصاص أسنان أطفال "
                + (f"(العمر: {age} سنة). " if age is not None else "")
                + "يرجى المتابعة مع طبيب أسنان أطفال."
            )
            return {"result": child_msg.strip(), "source_documents": []}

        if "لمعة" in question and not _has_trigger(question):
            ask_trigger = (
                "أهلاً! لنحدد الاختصاص بدقة لازم أعرف محفّز اللمعة:\n"
                "- هل تأتي مع البارد؟\n"
                "- مع الحلو؟\n"
                "- مع الحار/السخن؟\n"
                "- أم بدون سبب واضح (عفوية)؟\n"
                "أخبرني أيضاً عن مدة الألم بعد المحفّز."
            )
            return {"result": ask_trigger, "source_documents": []}

        rewritten = rewrite_chain.invoke({"question": question})

        docs = retriever.invoke(rewritten)
        context = "\n\n".join(doc.page_content for doc in docs)

        if not docs or not context.strip():
            fallback = (
                "أهلاً! أنا مساعد فرز لحالات الأسنان. "
                "حاول توصفلي أكثر: أين مكان الألم بالضبط؟ منذ متى بدأ؟ "
                "هل يزداد مع البارد أو الحار أو عند العض؟ وهل يوجد تورّم أو نزف أو حرارة عامة؟"
            )
            return {"result": fallback, "source_documents": []}

        answer = triage_chain.invoke({"context": context, "question": question})
        return {"result": answer, "source_documents": docs}

    return RunnableLambda(_run)
