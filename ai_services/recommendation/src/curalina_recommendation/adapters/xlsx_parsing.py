"""Pure parsing helpers for the Four Hands / Moe's combined workbook.

These functions are the real R01 logic (per ADR-0005's column-to-field
mapping table): the source workbook is a two-supplier merge with
duplicated header names (`Trade Price` twice, the dimension column twice,
`Weight (lbs)` twice, `Key Features` twice, `Colour` twice, three material
columns), so every reader in this package addresses columns by **zero-based
index**, never by header name, and unions the supplier-specific column
pairs explicitly rather than trusting `pandas`' auto-deduplicated header
names.

Column indices below match `Sheet1` of
`attached_assets/All_Four_Hands_and_Moes_Products_Combined New_1762391396825.xlsx`
(md5 `3ad1f5d7e47cca273e3fecd5ede64054`) as verified in ADR-0005. They are
specific to that file's layout, not a general workbook contract.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from decimal import Decimal

# --- Column indices (zero-based), per ADR-0005's verification table ---
COL_NAME = 0
COL_OVERVIEW = 1
COL_SUPPLIER = 2
COL_SKU = 3
COL_TRADE_PRICE_A = 4  # "Trade Price " (Four Hands side)
COL_RETAIL_PRICE = 5
COL_CATEGORY = 6
COL_ROOM_TYPE = 7
COL_DESIGN_STYLE = 8
COL_KEY_FEATURES_A = 9
COL_STORAGE_SOLUTIONS = 10
COL_DIMENSIONS_A = 11  # Moe's-side dimension string
COL_WEIGHT_A = 17
COL_COLOUR_A = 18
COL_MATERIAL_A = 19  # "Product Material"
COL_LEAD_TIME = 21
COL_INVENTORY = 22
COL_DELIVERY_OPTIONS = 23
COL_DELIVERY_LOCATION = 24
COL_DELIVERY_POLICY = 25
COL_TAGS = 26
COL_SOURCE_FILE = 27
COL_TRADE_PRICE_B = 28  # "Trade Price" (Four Hands / remaining Moe's side)
COL_DIMENSIONS_B = 29  # Four Hands / remaining Moe's dimension string
COL_WEIGHT_B = 30
COL_MATERIAL_B = 31  # "Material"
COL_MATERIAL_C = 33  # "Product Materials"
COL_KEY_FEATURES_B = 34
COL_COLOUR_B = 35

TRADE_PRICE_COLS = (COL_TRADE_PRICE_A, COL_TRADE_PRICE_B)
DIMENSIONS_COLS = (COL_DIMENSIONS_A, COL_DIMENSIONS_B)
WEIGHT_COLS = (COL_WEIGHT_A, COL_WEIGHT_B)
KEY_FEATURES_COLS = (COL_KEY_FEATURES_A, COL_KEY_FEATURES_B)
COLOUR_COLS = (COL_COLOUR_A, COL_COLOUR_B)
MATERIAL_COLS = (COL_MATERIAL_A, COL_MATERIAL_B, COL_MATERIAL_C)
DELIVERY_COLS = (COL_DELIVERY_OPTIONS, COL_DELIVERY_LOCATION, COL_DELIVERY_POLICY)

# ISO 4217 reserves "XXX" for "no currency involved" (ISO 4217:2015, X
# codes). This workbook has no currency column and no client confirmation
# of USD vs CAD (ADR-0005, "What would make this authoritative" item 2),
# so every `Money` built from it uses this sentinel rather than a guessed
# real currency. It must never be treated as a tradeable currency code.
UNCONFIRMED_CURRENCY = "XXX"

_JUNK_CATEGORY_VALUES = frozenset({"Final CSV-Ready Summary"})

# Both supplier dimension formats are `<num><quote><letter>` triples in
# width/depth/height order, differing only in quote glyph and case:
#   col 11 (Moe's):       20.5” W X 18.5” D X 22.7” H
#   col 29 (Four Hands):  78.75"w x 15.00"d x 30.75"h
_DIMENSION_TOKEN = re.compile(
    r"(?P<value>\d+(?:\.\d+)?)\s*[\"“”]?\s*(?P<axis>[wWdDhH])"
)


def first_non_blank(*values: object) -> object | None:
    """Return the first value that is neither `None` nor a blank string.

    Used to union the workbook's duplicated supplier-specific columns
    (e.g. the two `Trade Price` columns): per ADR-0005 the fill counts
    are complementary by supplier, so at most one of a pair is ever
    populated for a given row.
    """

    for value in values:
        if value is None:
            continue
        if isinstance(value, str) and not value.strip():
            continue
        return value
    return None


def parse_money_decimal(value: object) -> Decimal | None:
    """Convert a raw price cell to `Decimal` via `Decimal(str(v))`.

    Never routes through `float` (per `03_data_contracts.md`: "never
    binary float totals"). Returns `None` for a blank/unparseable cell
    rather than raising, so callers can record a `missing_price` finding
    instead of a crash.
    """

    if value is None:
        return None
    if isinstance(value, str) and not value.strip():
        return None
    try:
        return Decimal(str(value))
    except Exception:  # noqa: BLE001 - any malformed cell is "unparseable"
        return None


@dataclass(frozen=True, slots=True)
class ParsedDimensions:
    width_in: Decimal
    depth_in: Decimal | None
    height_in: Decimal


def parse_dimensions_inches(text: object) -> ParsedDimensions | None:
    """Parse a `"<w>\" W X <d>\" D X <h>\" H"`-style string (either supplier
    format, curly or straight quotes, either case) into inches.

    Returns `None` when fewer than the width and height axes are found
    (a dimension string that cannot be resolved to at least W and H is not
    usable for `Dimensions.from_inches`, which requires both). Depth is
    optional in the domain type, so a W/H-only match still succeeds.
    """

    if not isinstance(text, str) or not text.strip():
        return None
    found: dict[str, Decimal] = {}
    for match in _DIMENSION_TOKEN.finditer(text):
        axis = match.group("axis").lower()
        if axis in found:
            continue  # keep the first occurrence of a given axis
        found[axis] = Decimal(match.group("value"))
    if "w" not in found or "h" not in found:
        return None
    return ParsedDimensions(
        width_in=found["w"], depth_in=found.get("d"), height_in=found["h"]
    )


def primary_category(raw: object) -> str | None:
    """Apply R01's recommended primary-category rule: the first
    comma-delimited token of `Furniture Category`, trimmed.

    This is a recommendation, not a resolved fact (ADR-0005: "R01 must
    recommend a rule; it must not invent a default silently") — a
    multi-value category column has no single correct primary value, and
    this function exists so the rule is named, applied consistently, and
    inspectable, rather than embedded ad hoc in a notebook cell.

    Returns `None` for a blank cell (ADR-0005 records exactly two such
    rows) so callers can reject rather than default it.
    """

    if not isinstance(raw, str) or not raw.strip():
        return None
    return raw.split(",")[0].strip()


def is_known_junk_category(value: str) -> bool:
    """True for category values that are spreadsheet artefacts, not
    furniture categories (ADR-0005 finding 5: `Final CSV-Ready Summary`
    on `ER-1073-03`). Recorded as a flagged finding, never silently
    dropped or silently reassigned.
    """

    return value in _JUNK_CATEGORY_VALUES


def is_datetime_like(value: object) -> bool:
    """True when a `LEAD Time` cell is a `datetime`/`date`, not a duration
    (ADR-0005 finding 6). Kept as a tiny predicate so both the importer and
    the audit service apply the identical check.
    """

    import datetime as _dt

    return isinstance(value, (_dt.date, _dt.datetime))
