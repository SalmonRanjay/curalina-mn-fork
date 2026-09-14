"""Authors `VocabularyMap` from the mapper workbook's canonical lists plus
an explicit, hand-inspected synonym/out-of-axis dictionary.

The synonym and out-of-axis entries below were authored by direct
inspection of the pinned workbook's raw `Design Style`/`Tags`/`Room Type`
column values (`attached_assets/All_Four_Hands_and_Moes_Products_Combined
New_1762391396825.xlsx`, md5 `3ad1f5d7...`) — every entry is a specific
observed string, never a fuzzy-matched guess (ADR-0006 §D4: "anything not
confidently mappable is unmapped — never best-guessed"). This is the one
place new drift variants are added; running this module against a
replacement workbook may surface strings not covered here, which then
resolve as `unresolvable` rather than silently as anything else.
"""

from __future__ import annotations

from curalina_recommendation.evaluation.mapper_workbook import (
    MapperCanonicalLists,
    read_mapper_canonical_lists,
)
from curalina_recommendation.evaluation.vocabulary import (
    MATERIAL_FAMILY_TAGS,
    VocabularyMap,
    canonical_key,
)

# --- Style axis -------------------------------------------------------
# Style spelling variants observed in the pinned workbook (R01's drift
# catalogue plus direct re-inspection for R02).
_STYLE_SYNONYM_RAW: dict[str, str] = {
    "warm transittional": "Warm Transitional",
    "mid-century scandinavian": "Mid-Century Scandi",
    "midcentury scandi": "Mid-Century Scandi",
    "contemporary luxe": "Contemporary Lux",
    "farmhouse": "Modern Farmhouse",
}

# Rows where the `Design Style` cell carries a room/category string
# instead of a style (§D3a-J's "column contamination, not style drift").
_STYLE_OUT_OF_AXIS_RAW: dict[str, str] = {
    "living room": "room_type_string_in_style_column",
    "bedroom": "room_type_string_in_style_column",
    "home office": "room_type_string_in_style_column",
    "entryway": "room_type_string_in_style_column",
    "chaise lounge": "category_string_in_style_column",
    "cabinet / sideboard / buffet": "category_string_in_style_column",
}

# --- Tag (atmosphere) axis --------------------------------------------
_TAG_SYNONYM_RAW: dict[str, str] = {
    "everyday elegence/gracious": "Everyday Elegance/Gracious",
    "everyday elegance": "Everyday Elegance/Gracious",
    "relaxed sophisitication/minimalist": "Relaxed Sophistication/ Minimalist",
    "nurturing refined": "Nurturing/Refined",
    "nurtuing/refined": "Nurturing/Refined",
    "family gatherings/humble": "Family Gatherings/ Humble",
    "family gatherings/hunble": "Family Gatherings/ Humble",
    "family gatherinegs/hunble": "Family Gatherings/ Humble",
    "elegant balanced": "Elegant/Balanced",
    "elegant /balanced": "Elegant/Balanced",
    "earthy & stone": "Earth & Stone",
    "earty & stone": "Earth & Stone",
    "white/oak/linen/travertine": "White Oak/Linen/Travertine",
    "i love patters": "I Love Patterns",
    "statement living/ glamorous evenings": "Statement Living/Glamorous Evenings",
    "statement living/glamorous evenings": "Statement Living/Glamorous Evenings",
}

# Functional/material tokens that legitimately carry no atmosphere
# equivalent in the mapper's vocabulary (§D4a bucket 2). `Outdoor
# Suitable` is the dominant contributor (43 rows) — a functional tag, not
# style drift. Loose material nouns appended to some tag cells (e.g.
# `marble`, `terrazo`, `Concrete`) describe the object, not its atmosphere.
_TAG_OUT_OF_AXIS_RAW: dict[str, str] = {
    "outdoor suitable": "functional_tag_no_atmosphere_equivalent",
    "marble": "material_noun_not_a_tag",
    "terrazo": "material_noun_not_a_tag",
    "concrete": "material_noun_not_a_tag",
}

# --- Room axis ----------------------------------------------------------
_ROOM_SYNONYM_RAW: dict[str, str] = {
    "living room": "Living room",
    "dining room": "Dining room",
    "home office": "Home office",
    "entryway": "Entryway",
}


def _keyed(mapping: dict[str, str]) -> dict[str, str]:
    return {canonical_key(k): v for k, v in mapping.items()}


def build_vocabulary_map(mapper_path: str) -> VocabularyMap:
    lists: MapperCanonicalLists = read_mapper_canonical_lists(mapper_path)
    return VocabularyMap(
        canonical_styles=lists.styles,
        canonical_tags=lists.tags,
        canonical_rooms=lists.rooms,
        material_family_tags=MATERIAL_FAMILY_TAGS,
        tag_reference=dict(lists.tag_reference),
        style_synonyms=_keyed(_STYLE_SYNONYM_RAW),
        style_out_of_axis=_keyed(_STYLE_OUT_OF_AXIS_RAW),
        tag_synonyms=_keyed(_TAG_SYNONYM_RAW),
        tag_out_of_axis=_keyed(_TAG_OUT_OF_AXIS_RAW),
        room_synonyms=_keyed(_ROOM_SYNONYM_RAW),
    )
