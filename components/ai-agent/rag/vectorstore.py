import os

from langchain_ollama import OllamaEmbeddings
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from langchain_text_splitters import RecursiveCharacterTextSplitter

from .loader import load_raw_texts

DEFAULT_DB_BASE_DIR = "chroma_db"
DEFAULT_DATA_DIR = "data"
EMBED_MODEL_NAME = "nomic-embed-text"
HF_EMBED_MODEL = "intfloat/multilingual-e5-base"


class SafeOllamaEmbeddings(OllamaEmbeddings):
    """Work around intermittent embed_documents failures by calling embed per text batch."""

    def embed_documents(self, texts):
        if not self._client:
            msg = (
                "Ollama client is not initialized. "
                "Please ensure Ollama is running and the model is loaded."
            )
            raise ValueError(msg)
        embeddings = []
        for text in texts:
            resp = self._client.embed(
                self.model,
                [text],
                options=self._default_params,
                keep_alive=self.keep_alive,
            )
            embeddings.append(resp["embeddings"][0])
        return embeddings

    def embed_query(self, text: str):
        return self.embed_documents([text])[0]


class E5Embeddings(HuggingFaceEmbeddings):
    """Wrapper to add required E5 prefixes."""

    def embed_query(self, text: str):
        return super().embed_query(f"query: {text}")

    def embed_documents(self, texts):
        return super().embed_documents([f"passage: {t}" for t in texts])


def _get_embed_backend_and_model():
    backend = (os.getenv("DENTAL_EMBED_BACKEND") or "huggingface").lower()
    model_name = os.getenv("HUGGINGFACE_EMBED_MODEL", HF_EMBED_MODEL)
    return backend, model_name


def _default_db_dir():
    backend, model_name = _get_embed_backend_and_model()
    suffix = model_name.replace("/", "__")
    base = os.getenv("DENTAL_DB_BASE_DIR", DEFAULT_DB_BASE_DIR)
    return f"{base}__{backend}__{suffix}"


def get_embeddings():
    """
    Select embeddings backend.
    - DENTAL_EMBED_BACKEND=huggingface (default) uses sentence-transformers (E5 wrapper).
    - DENTAL_EMBED_BACKEND=ollama uses local Ollama embeddings.
    """
    backend, model_name = _get_embed_backend_and_model()
    if backend == "huggingface":
        return E5Embeddings(model_name=model_name)
    if backend == "ollama":
        base_url = os.getenv("OLLAMA_HOST") or "http://127.0.0.1:11434"
        return SafeOllamaEmbeddings(model=EMBED_MODEL_NAME, base_url=base_url)
    raise ValueError(f"Unsupported embedding backend: {backend}")


def build_vectorstore(
    data_dir: str = DEFAULT_DATA_DIR,
    db_dir: str | None = None,
) -> Chroma:
    texts = load_raw_texts(data_dir=data_dir)
    db_dir = db_dir or _default_db_dir()

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

    embeddings = get_embeddings()
    os.makedirs(db_dir, exist_ok=True)

    vectordb = Chroma.from_documents(
        documents=documents,
        embedding=embeddings,
        persist_directory=db_dir,
    )
    return vectordb


def load_vectorstore(
    db_dir: str | None = None,
) -> Chroma:
    db_dir = db_dir or _default_db_dir()
    if not os.path.isdir(db_dir) or not os.listdir(db_dir):
        raise ValueError(
            f"U.O U?US U?UØOñO3 Chroma OªOUØOý O_OOrU, '{db_dir}'. "
            "O\"O_UŸ O¦U+OO_US build_vectorstore OœU^U, U.OñOc."
        )

    embeddings = get_embeddings()

    vectordb = Chroma(
        embedding_function=embeddings,
        persist_directory=db_dir,
    )
    return vectordb


def get_or_create_vectorstore(
    data_dir: str = DEFAULT_DATA_DIR,
    db_dir: str | None = None,
    rebuild: bool = False,
) -> Chroma:
    db_dir = db_dir or _default_db_dir()
    if rebuild or not os.path.isdir(db_dir) or not os.listdir(db_dir):
        print("dY\"s O1U. U+O\"U+US Chroma DB (dental-kb) U.U+ OU,OæU?Oñ...")
        return build_vectorstore(data_dir=data_dir, db_dir=db_dir)

    print("ƒo. U,U,USO¦ Chroma DB OªOUØOýOcOO O1U. OœO-U.U`U,UØO...")
    return load_vectorstore(db_dir=db_dir)
