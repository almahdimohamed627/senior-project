import hashlib
from typing import Any, Iterable, List

from langchain_core.documents import Document
from langchain_core.retrievers import BaseRetriever

try:
    from pydantic import ConfigDict
except ImportError:
    ConfigDict = None


def _doc_key(doc: Document) -> str:
    meta = doc.metadata or {}
    chunk_id = meta.get("chunk_id")
    if chunk_id:
        return f"chunk:{chunk_id}"
    source = meta.get("source", "")
    content = doc.page_content or ""
    content_hash = hashlib.sha1(content.encode("utf-8")).hexdigest()
    return f"{source}:{content_hash}"


def rrf_fuse(
    dense_docs: Iterable[Document],
    bm25_docs: Iterable[Document],
    rrf_k: int,
    top_n: int,
) -> List[Document]:
    scores: dict[str, float] = {}
    doc_map: dict[str, Document] = {}

    def add_docs(docs: Iterable[Document]) -> None:
        for rank, doc in enumerate(docs, start=1):
            key = _doc_key(doc)
            scores[key] = scores.get(key, 0.0) + 1.0 / (rrf_k + rank)
            if key not in doc_map:
                doc_map[key] = doc

    add_docs(dense_docs)
    add_docs(bm25_docs)

    ranked_keys = sorted(scores.items(), key=lambda item: (-item[1], item[0]))
    return [doc_map[key] for key, _ in ranked_keys[:top_n]]


class HybridRRFRetriever(BaseRetriever):
    dense_retriever: Any
    bm25_retriever: Any
    rrf_k: int = 60
    out_k: int = 8

    if ConfigDict is not None:
        model_config = ConfigDict(arbitrary_types_allowed=True)
    else:
        class Config:
            arbitrary_types_allowed = True

    def _get_relevant_documents(self, query: str) -> List[Document]:
        dense_docs = self.dense_retriever.invoke(query)
        bm25_docs = self.bm25_retriever.invoke(query)
        return rrf_fuse(dense_docs, bm25_docs, rrf_k=self.rrf_k, top_n=self.out_k)

    async def _aget_relevant_documents(self, query: str) -> List[Document]:
        dense_docs = await _ainvoke(self.dense_retriever, query)
        bm25_docs = await _ainvoke(self.bm25_retriever, query)
        return rrf_fuse(dense_docs, bm25_docs, rrf_k=self.rrf_k, top_n=self.out_k)


async def _ainvoke(retriever: Any, query: str) -> List[Document]:
    if hasattr(retriever, "ainvoke"):
        return await retriever.ainvoke(query)
    return retriever.invoke(query)
