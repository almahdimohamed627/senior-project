import sys

from rag.vectorstore import get_or_create_vectorstore
from rag.qa import create_qa_chain

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")


def main():
    print("🦷 Dental RAG Assistant")
    print("-----------------------")

    try:
        vectordb = get_or_create_vectorstore()
    except Exception as e:
        print("❌ صار خطأ أثناء تجهيز الـ Vector DB:")
        print(e)
        sys.exit(1)

    qa = create_qa_chain(vectordb)

    patient_age = None
    while patient_age is None:
        raw_age = input("⏢ عمر المريض (بالسنين، مثال 25 أو 10): ").strip()
        if not raw_age:
            print("رجاءً أدخل رقم تقريبي للعمر.")
            continue
        try:
            patient_age = int(raw_age)
        except ValueError:
            print("حاول تكتب العمر كرقم فقط (مثلاً 12).")

    age_prefix = f"عمر المريض: {patient_age} سنة.\n"

    print("✅ النظام جاهز. اكتب شكوى المريض عن طب الأسنان (أو 'exit' للخروج).")

    while True:
        try:
            user_text = input("\nسؤالك/شكوى المريض: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n👋 سلامات")
            break

        if not user_text:
            continue

        if user_text.lower() in {"exit", "quit"}:
            print("👋 سلامات")
            break

        query = age_prefix + "شكوى المريض: " + user_text

        try:
            result = qa.invoke({"query": query})
        except Exception as e:
            print("❌ صار خطأ أثناء الاستعلام:")
            print(e)
            continue

        answer = result.get("result", "")
        sources = result.get("source_documents", [])

        print("\n💬 الجواب:\n")
        print(answer)

        if sources:
            print("\n📚 المصادر (chunks من ملفاتك):")
            for i, doc in enumerate(sources, start=1):
                meta = doc.metadata or {}
                source = meta.get("source", "unknown")
                print(f"  [{i}] من الملف: {source}")


if __name__ == "__main__":
    main()
