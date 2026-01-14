import os
import re
from typing import List, Optional

from langchain_core.documents import Document

# Arabic char range + Latin letters
_AR_CHARS = re.compile(r"[\u0600-\u06FF]")
_LAT_CHARS = re.compile(r"[A-Za-z]")


def _is_arabic_text(text: str) -> bool:
    """
    Heuristic to keep ONLY Arabic content.
    - Needs enough Arabic characters
    - Arabic chars must dominate Latin chars (avoid English-heavy snippets)
    """
    t = (text or "").strip()
    if not t:
        return False

    ar = len(_AR_CHARS.findall(t))
    lat = len(_LAT_CHARS.findall(t))

    # Tuneable thresholds (env)
    min_ar = int(os.getenv("DENTAL_WEB_AR_MIN_CHARS", "40"))
    ratio = float(os.getenv("DENTAL_WEB_AR_RATIO", "3"))  # ar >= lat * ratio

    if ar < min_ar:
        return False
    if lat > 0 and ar < (lat * ratio):
        return False

    return True


def _parse_allowed_domains() -> Optional[List[str]]:
    raw = (os.getenv("DENTAL_WEB_ALLOWED_DOMAINS") or "").strip()
    if not raw:
        return None
    # split by comma and clean
    domains = [d.strip() for d in raw.split(",") if d.strip()]
    return domains or None


def _url_looks_arabic(url: str) -> bool:
    """
    Optional URL hint filter. Not a guarantee, but helps.
    Enabled via DENTAL_WEB_ARABIC_URL_HINT=true
    """
    if not url:
        return False
    u = url.lower()
    hints = [
        "/ar/", "/arab", "lang=ar", "language=ar", "locale=ar",
        "/العربية", "ar."
    ]
    return any(h in u for h in hints)


def tavily_search_documents(query: str) -> List[Document]:
    query = (query or "").strip()
    api_key = (os.getenv("TAVILY_API_KEY") or "").strip()
    if not query or not api_key:
        return []

    try:
        from tavily import TavilyClient
    except Exception:
        # Tavily not installed -> treat as disabled
        return []

    max_results = int(os.getenv("DENTAL_WEB_MAX_RESULTS", "5"))
    search_depth = os.getenv("DENTAL_WEB_SEARCH_DEPTH", "basic")

    # Strict Arabic filtering enabled by default
    arabic_only = (os.getenv("DENTAL_WEB_ARABIC_ONLY", "true") or "true").lower() in {
        "1",
        "true",
        "yes",
    }

    # Optional URL-hint filter (extra strict)
    url_hint = (os.getenv("DENTAL_WEB_ARABIC_URL_HINT", "false") or "false").lower() in {
        "1",
        "true",
        "yes",
    }

    allowed_domains = _parse_allowed_domains()

    client = TavilyClient(api_key=api_key)

    # Pass include_domains if provided
    try:
        if allowed_domains:
            res = client.search(
                query=query,
                max_results=max_results,
                search_depth=search_depth,
                include_domains=allowed_domains,
            )
        else:
            res = client.search(
                query=query,
                max_results=max_results,
                search_depth=search_depth,
            )
    except Exception:
        # Network/auth/etc -> fail closed
        return []

    docs: List[Document] = []

    for item in (res.get("results") or []):
        content = (item.get("content") or "").strip()
        url = (item.get("url") or "").strip()
        title = (item.get("title") or "بدون عنوان").strip()

        if not content:
            continue

        # Arabic-only filter
        if arabic_only:
            text_for_lang = f"{title}\n{content}"
            if not _is_arabic_text(text_for_lang):
                continue

            if url_hint and not _url_looks_arabic(url):
                continue

        docs.append(
            Document(
                page_content=content,
                metadata={
                    "source": url,
                    "title": title,
                    "origin": "web",
                    "lang": "ar" if arabic_only else "auto",
                },
            )
        )

    # If arabic_only is enabled, we intentionally return ONLY Arabic docs.
    return docs
