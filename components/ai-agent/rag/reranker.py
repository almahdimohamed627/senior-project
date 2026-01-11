import os
from functools import lru_cache
from typing import List

from langchain_core.documents import Document
from sentence_transformers import CrossEncoder


@lru_cache(maxsize=1)
def _load_model(model_name: str) -> CrossEncoder:
    return CrossEncoder(model_name)


def rerank(query: str, docs: List[Document], top_k: int) -> List[Document]:
    if not docs:
        return []

    model_name = os.getenv("DENTAL_RERANK_MODEL", "NAMAA-ARA-Reranker-V1")
    model = _load_model(model_name)

    pairs = [(query, d.page_content) for d in docs]
    scores = model.predict(pairs)

    ranked = sorted(zip(docs, scores), key=lambda x: float(x[1]), reverse=True)
    top = ranked[: min(top_k, len(ranked))]

    reranked_docs: List[Document] = []
    for doc, score in top:
        meta = dict(doc.metadata) if doc.metadata else {}
        meta["rerank_score"] = float(score)
        reranked_docs.append(Document(page_content=doc.page_content, metadata=meta))
    return reranked_docs
