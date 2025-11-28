from rag.vectorstore import get_or_create_vectorstore

if __name__ == "__main__":
    print("📚 Rebuilding dental vector DB from data/ ...")
    get_or_create_vectorstore(rebuild=True)
    print("✅ Done. Chroma DB is ready.")
