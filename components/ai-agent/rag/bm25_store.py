import json
import os
from typing import Iterable, List

from langchain_core.documents import Document
from langchain_community.retrievers import BM25Retriever


def save_docs_jsonl(docs: Iterable[Document], path: str) -> None:
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        for doc in docs:
            payload = {
                "page_content": doc.page_content,
                "metadata": doc.metadata or {},
            }
            f.write(json.dumps(payload, ensure_ascii=False) + "\n")


def load_docs_jsonl(path: str) -> List[Document]:
    docs: List[Document] = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            data = json.loads(line)
            docs.append(
                Document(
                    page_content=data.get("page_content", ""),
                    metadata=data.get("metadata") or {},
                )
            )
    return docs


def build_bm25_retriever(docs_path: str, k: int) -> BM25Retriever:
    docs = load_docs_jsonl(docs_path)
    retriever = BM25Retriever.from_documents(docs)
    retriever.k = k
    return retriever
