"""Frozen normalization vocabulary for R02 relevance labels.

ADR-0006 §D4 requires labels to be derived from a published, deterministic
normalization map authored against the client's Quiz and Product Mapper
workbook's canonical lists (`SUB-CATEGORIES` sheet) — never invented.
Amendment 1 §D4a resolves §D4's `unmapped` ambiguity into three explicit
buckets per observed token:

1. **canonical** — resolves to a mapper vocabulary term.
2. **out_of_axis** — a recognised non-atmosphere/non-style concept
   (functional tags, material tags, room/category strings misfiled into
   the style column). Carries no label information for that axis; does
   not count toward the `unmapped` coverage guard.
3. **unresolvable** — neither of the above.

Every mapping entry here is an explicit, authored dictionary entry
computed once by direct inspection of the pinned workbook's raw column
values (never a fuzzy match applied at label-derivation time) — anything
not confidently mappable is `unresolvable`, never best-guessed.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from enum import StrEnum

_WS = re.compile(r"\s+")
_SLASH_SPACE = re.compile(r"\s*/\s*")


class Bucket(StrEnum):
    CANONICAL = "canonical"
    OUT_OF_AXIS = "out_of_axis"
    UNRESOLVABLE = "unresolvable"


def canonical_key(raw: str) -> str:
    """Case/whitespace/slash-spacing normalization only — never a fuzzy
    match. Two tokens differing only in case, surrounding whitespace, or
    spacing around a `/` collapse to the same key; anything else needs an
    explicit dictionary entry to resolve."""

    text = raw.strip().lower()
    text = _SLASH_SPACE.sub("/", text)
    text = _WS.sub(" ", text)
    return text.rstrip(".,;")


# The five material-family tags §D3a-F excludes from the atmosphere axis
# (they remain valid label inputs; they may not define a brief, and their
# token-level echo into `Overview` is why).
MATERIAL_FAMILY_TAGS: tuple[str, ...] = (
    "Walnut",
    "White Oak/Linen/Travertine",
    "Shiplap/Wrought Iron",
    "Velvet/Brass/Smoked Glass",
    "Satin/Metallics",
)


@dataclass(frozen=True, slots=True)
class VocabularyMap:
    """The frozen, authored normalization artifact
    (`evaluation/vocabulary_map_v1.yaml` once written by `freeze.py`)."""

    canonical_styles: tuple[str, ...]
    canonical_tags: tuple[str, ...]
    canonical_rooms: tuple[str, ...]
    material_family_tags: tuple[str, ...]
    tag_reference: dict[str, str] = field(default_factory=dict)
    style_synonyms: dict[str, str] = field(default_factory=dict)
    style_out_of_axis: dict[str, str] = field(default_factory=dict)
    tag_synonyms: dict[str, str] = field(default_factory=dict)
    tag_out_of_axis: dict[str, str] = field(default_factory=dict)
    room_synonyms: dict[str, str] = field(default_factory=dict)

    def classify(self, raw: str, axis: str) -> tuple[Bucket, str | None]:
        key = canonical_key(raw)
        if axis == "style":
            canon = {canonical_key(s): s for s in self.canonical_styles}
            if key in canon:
                return Bucket.CANONICAL, canon[key]
            if key in self.style_synonyms:
                return Bucket.CANONICAL, self.style_synonyms[key]
            if key in self.style_out_of_axis:
                return Bucket.OUT_OF_AXIS, None
            return Bucket.UNRESOLVABLE, None
        if axis == "tag":
            canon = {canonical_key(t): t for t in self.canonical_tags}
            if key in canon:
                return Bucket.CANONICAL, canon[key]
            if key in self.tag_synonyms:
                return Bucket.CANONICAL, self.tag_synonyms[key]
            if key in self.tag_out_of_axis:
                return Bucket.OUT_OF_AXIS, None
            return Bucket.UNRESOLVABLE, None
        if axis == "room":
            canon = {canonical_key(r): r for r in self.canonical_rooms}
            if key in canon:
                return Bucket.CANONICAL, canon[key]
            if key in self.room_synonyms:
                return Bucket.CANONICAL, self.room_synonyms[key]
            return Bucket.UNRESOLVABLE, None
        raise ValueError(f"unknown axis {axis!r}")

    def to_dict(self) -> dict[str, object]:
        return {
            "canonical_styles": list(self.canonical_styles),
            "canonical_tags": list(self.canonical_tags),
            "canonical_rooms": list(self.canonical_rooms),
            "material_family_tags": list(self.material_family_tags),
            "tag_reference": dict(self.tag_reference),
            "style_synonyms": dict(self.style_synonyms),
            "style_out_of_axis": dict(self.style_out_of_axis),
            "tag_synonyms": dict(self.tag_synonyms),
            "tag_out_of_axis": dict(self.tag_out_of_axis),
            "room_synonyms": dict(self.room_synonyms),
        }

    @classmethod
    def from_dict(cls, data: dict[str, object]) -> VocabularyMap:
        def _tuple(key: str) -> tuple[str, ...]:
            value = data[key]
            assert isinstance(value, list)
            return tuple(str(v) for v in value)

        def _dict(key: str) -> dict[str, str]:
            value = data[key]
            assert isinstance(value, dict)
            return {str(k): str(v) for k, v in value.items()}

        return cls(
            canonical_styles=_tuple("canonical_styles"),
            canonical_tags=_tuple("canonical_tags"),
            canonical_rooms=_tuple("canonical_rooms"),
            material_family_tags=_tuple("material_family_tags"),
            tag_reference=_dict("tag_reference"),
            style_synonyms=_dict("style_synonyms"),
            style_out_of_axis=_dict("style_out_of_axis"),
            tag_synonyms=_dict("tag_synonyms"),
            tag_out_of_axis=_dict("tag_out_of_axis"),
            room_synonyms=_dict("room_synonyms"),
        )
