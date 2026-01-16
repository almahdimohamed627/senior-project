import os

from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from langchain_text_splitters import RecursiveCharacterTextSplitter

from .loader import load_raw_texts
from .bm25_store import save_docs_jsonl

DEFAULT_DB_BASE_DIR = "chroma_db"
DEFAULT_DATA_DIR = "data"
HF_EMBED_MODEL = "intfloat/multilingual-e5-base"
BM25_DOCS_FILENAME = "bm25_docs.jsonl"


class E5Embeddings(HuggingFaceEmbeddings):
    """Wrapper to add required E5 prefixes."""

    def embed_query(self, text: str):
        return super().embed_query(f"query: {text}")

    def embed_documents(self, texts):
        return super().embed_documents([f"passage: {t}" for t in texts])


def _default_db_dir():
    """
    Generate a stable Chroma persist directory based on model
    to avoid dimension mismatches when switching embeddings.
    Example:
      chroma_db_huggingface__intfloat__multilingual-e5-base
    """
    model_name = os.getenv("HUGGINGFACE_EMBED_MODEL", HF_EMBED_MODEL)
    suffix = model_name.replace("/", "__")
    base = os.getenv("DENTAL_DB_BASE_DIR", DEFAULT_DB_BASE_DIR)

    # IMPORTANT: keep naming stable for existing DBs.
    return f"{base}_huggingface__{suffix}"


def get_embeddings():
    """
    Return HuggingFace embeddings (E5 wrapper).
    """
    model_name = os.getenv("HUGGINGFACE_EMBED_MODEL", HF_EMBED_MODEL)
    return E5Embeddings(model_name=model_name)


def build_vectorstore(
    data_dir: str = DEFAULT_DATA_DIR,
    db_dir: str | None = None,
) -> Chroma:
    texts = load_raw_texts(data_dir=data_dir)
    db_dir = db_dir or _default_db_dir()

    print(f"🧠 Building Chroma DB from '{data_dir}' ...")
    print(f"📦 Chroma persist_directory = {db_dir}")

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=800,
        chunk_overlap=150,
    )

    documents = []
    for content, path in texts:
        docs_for_file = splitter.create_documents(
            [content],
            metadatas=[{"source": path}],
        )
        for idx, doc in enumerate(docs_for_file):
            doc.metadata = doc.metadata or {}
            doc.metadata["source"] = path
            doc.metadata["chunk_id"] = f"{path}::chunk-{idx}"
        documents.extend(docs_for_file)

    embeddings = get_embeddings()
    os.makedirs(db_dir, exist_ok=True)

    bm25_docs_path = os.path.join(db_dir, BM25_DOCS_FILENAME)
    if not os.path.isfile(bm25_docs_path):
        save_docs_jsonl(documents, bm25_docs_path)

    vectordb = Chroma.from_documents(
        documents=documents,
        embedding=embeddings,
        persist_directory=db_dir,
    )
    vectordb.bm25_docs_path = bm25_docs_path
    return vectordb


def load_vectorstore(
    db_dir: str | None = None,
) -> Chroma:
    db_dir = db_dir or _default_db_dir()

    if not os.path.isdir(db_dir) or not os.listdir(db_dir):
        raise ValueError(
            f"لا يوجد Chroma DB جاهز ضمن المسار: '{db_dir}'.\n"
            "الحل:\n"
            "- شغّل: python ingest.py\n"
            "أو مرّر rebuild=True عند إنشاء الـ vectorstore."
        )

    print(f"✅ Loading existing Chroma DB ...")
    print(f"📦 Chroma persist_directory = {db_dir}")

    embeddings = get_embeddings()

    vectordb = Chroma(
        embedding_function=embeddings,
        persist_directory=db_dir,
    )
    vectordb.bm25_docs_path = os.path.join(db_dir, BM25_DOCS_FILENAME)
    return vectordb


def get_or_create_vectorstore(
    data_dir: str = DEFAULT_DATA_DIR,
    db_dir: str | None = None,
    rebuild: bool = False,
) -> Chroma:
    db_dir = db_dir or _default_db_dir()

    if rebuild or not os.path.isdir(db_dir) or not os.listdir(db_dir):
        print("🔧 Rebuilding Chroma DB (dental-kb) ...")
        print(f"📦 Chroma persist_directory = {db_dir}")
        return build_vectorstore(data_dir=data_dir, db_dir=db_dir)

    print("✅ Using existing Chroma DB (dental-kb) ...")
    print(f"📦 Chroma persist_directory = {db_dir}")
    return load_vectorstore(db_dir=db_dir)
