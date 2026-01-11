import sys

from rag.vectorstore import get_or_create_vectorstore

if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")

    print("Rebuilding dental vector DB from data/ ...")
    get_or_create_vectorstore(rebuild=True)
    print("Done. Chroma DB is ready.")
