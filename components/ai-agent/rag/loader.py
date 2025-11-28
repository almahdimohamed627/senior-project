import os
from typing import List, Tuple


def load_raw_texts(data_dir: str = "data") -> List[Tuple[str, str]]:
    texts: List[Tuple[str, str]] = []

    if not os.path.isdir(data_dir):
        raise ValueError(f"مجلد البيانات '{data_dir}' مو موجود.")

    for root, _, files in os.walk(data_dir):
        for name in files:
            if name.lower().endswith(".txt"):
                path = os.path.join(root, name)
                with open(path, "r", encoding="utf-8") as f:
                    content = f.read().strip()
                    if content:
                        texts.append((content, path))

    if not texts:
        raise ValueError(f"ما لقيت ولا ملف .txt فيه محتوى داخل '{data_dir}'.")

    return texts
