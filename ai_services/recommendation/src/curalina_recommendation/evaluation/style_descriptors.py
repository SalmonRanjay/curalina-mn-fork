"""Extracts designer-authored style descriptor words from the mapper
workbook's `Design Style Definitions` sheet, for `RuleOnlyEncoder`'s
lexical baseline (ADR-0006 §D2's redefinition: "the style's
designer-authored descriptor words from the mapper's `Design Style
Definitions` sheet").
"""

from __future__ import annotations

import re

from curalina_recommendation.adapters.xlsx_workbook_reader import read_workbook_rows
from curalina_recommendation.evaluation.vocabulary import Bucket, VocabularyMap

_TOKEN = re.compile(r"[a-zA-Z]+")
_MIN_LEN = 4
_STOPWORDS = frozenset(
    {
        "this",
        "that",
        "with",
        "from",
        "into",
        "than",
        "also",
        "such",
        "like",
        "more",
        "most",
        "very",
        "been",
        "being",
        "have",
        "their",
        "them",
        "they",
        "which",
        "while",
        "where",
        "when",
        "these",
        "each",
        "some",
        "over",
        "under",
        "about",
        "primary",
        "keyword",
        "keywords",
        "secondary",
        "search",
    }
)
_EXCLUDED_LABEL = "SEO Strategy"


def build_style_descriptors(
    mapper_path: str, vocab: VocabularyMap
) -> dict[str, frozenset[str]]:
    workbook = read_workbook_rows(mapper_path, sheet_name="Design Style Definitions")
    texts_by_style: dict[str, list[str]] = {}
    current_style: str | None = None
    for row in workbook.rows:
        label = row[0] if len(row) > 0 else None
        text = row[1] if len(row) > 1 else None
        if isinstance(label, str) and label.strip().startswith("Design Style:"):
            header_name = label.split(":", 1)[1].strip()
            bucket, canon = vocab.classify(header_name, "style")
            current_style = canon if bucket is Bucket.CANONICAL else None
            if current_style and isinstance(text, str):
                texts_by_style.setdefault(current_style, []).append(text)
            continue
        if current_style is None:
            continue
        if isinstance(label, str) and label.strip() == _EXCLUDED_LABEL:
            continue
        if isinstance(text, str):
            texts_by_style.setdefault(current_style, []).append(text)

    descriptors: dict[str, frozenset[str]] = {}
    for style, texts in texts_by_style.items():
        words: set[str] = set()
        for text in texts:
            for token in _TOKEN.findall(text.lower()):
                if len(token) >= _MIN_LEN and token not in _STOPWORDS:
                    words.add(token)
        descriptors[style] = frozenset(words)
    return descriptors
