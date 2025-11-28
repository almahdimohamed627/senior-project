import os

from langchain_ollama import OllamaEmbeddings
from langchain_chroma import Chroma
from langchain_text_splitters import RecursiveCharacterTextSplitter

from .loader import load_raw_texts

DEFAULT_DB_DIR = "chroma_db"
DEFAULT_DATA_DIR = "data"
EMBED_MODEL_NAME = "nomic-embed-text"


def build_vectorstore(
    data_dir: str = DEFAULT_DATA_DIR,
    db_dir: str = DEFAULT_DB_DIR,
) -> Chroma:
    texts = load_raw_texts(data_dir=data_dir)

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
        documents.extend(docs_for_file)

    embeddings = OllamaEmbeddings(model=EMBED_MODEL_NAME)
    os.makedirs(db_dir, exist_ok=True)

    vectordb = Chroma.from_documents(
        documents=documents,
        embedding=embeddings,
        persist_directory=db_dir,
    )
    return vectordb


def load_vectorstore(
    db_dir: str = DEFAULT_DB_DIR,
) -> Chroma:
    if not os.path.isdir(db_dir) or not os.listdir(db_dir):
        raise ValueError(
            f"ما في فهرس Chroma جاهز داخل '{db_dir}'. "
            "بدك تنادي build_vectorstore أول مرة."
        )

    embeddings = OllamaEmbeddings(model=EMBED_MODEL_NAME)

    vectordb = Chroma(
        embedding_function=embeddings,
        persist_directory=db_dir,
    )
    return vectordb


def get_or_create_vectorstore(
    data_dir: str = DEFAULT_DATA_DIR,
    db_dir: str = DEFAULT_DB_DIR,
    rebuild: bool = False,
) -> Chroma:
    if rebuild or not os.path.isdir(db_dir) or not os.listdir(db_dir):
        print("📚 عم نبني Chroma DB (dental-kb) من الصفر...")
        return build_vectorstore(data_dir=data_dir, db_dir=db_dir)

    print("✅ لقيت Chroma DB جاهزة، عم أحمّلها...")
    return load_vectorstore(db_dir=db_dir)
