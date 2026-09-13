"""R01's audit metrics and failure-analysis logic.

Every finding this module computes is scoped to whatever `WorkbookRows` it
is given — it carries no knowledge of "the Curalina catalogue" and no
file path of its own. The notebook is responsible for pinning the exact
file (and reporting its hash) before calling in here; this module only
profiles whatever rows it receives, which is what keeps it reusable
against a re-export later without becoming a source of "which catalogue"
ambiguity.

Per ADR-0005's verification checklist, this module reproduces (not
merely restates) each factual claim: duplicate `(supplier, sku)` pairs,
`Source File` mislabelling, category taxonomy drift, dimension-string
parse coverage, `LEAD Time` type inconsistency, empty delivery columns,
and the rug/lighting/accent-chair/coffee-table absence checks.
"""

from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from curalina_recommendation.domain.product import Product

from curalina_recommendation.adapters.xlsx_parsing import (
    COL_CATEGORY,
    COL_DESIGN_STYLE,
    COL_LEAD_TIME,
    COL_NAME,
    COL_RETAIL_PRICE,
    COL_ROOM_TYPE,
    COL_SKU,
    COL_SOURCE_FILE,
    COL_SUPPLIER,
    COL_TAGS,
    DELIVERY_COLS,
    DIMENSIONS_COLS,
    TRADE_PRICE_COLS,
    first_non_blank,
    is_datetime_like,
    is_known_junk_category,
    parse_dimensions_inches,
    parse_money_decimal,
    primary_category,
)
from curalina_recommendation.adapters.xlsx_workbook_reader import WorkbookRows

_RUG_LIGHTING_PATTERN = re.compile(r"rug|lamp|light|pendant|sconce|chandelier", re.I)


@dataclass(frozen=True, slots=True)
class DuplicateKeyFinding:
    supplier: str
    sku: str
    occurrences: int
    source_files: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class WorkbookAuditReport:
    """Every finding R01 must retain and show, per the notebook standard's
    "no cherry-picking" failure-analysis rule. Fields ending `_rows` or
    `_findings` are the raw failure lists, not just their counts.
    """

    total_rows: int
    supplier_counts: dict[str, int]
    distinct_supplier_sku_pairs: int
    duplicate_key_findings: tuple[DuplicateKeyFinding, ...]
    source_file_supplier_mismatch_rows: tuple[int, ...]
    distinct_source_files: tuple[str, ...]
    category_blank_row_indices: tuple[int, ...]
    junk_category_rows: tuple[tuple[int, str, str], ...]  # (row_idx, sku, category)
    coffee_table_row_count: int
    rug_lighting_accent_chair_row_count: int
    dimensions_unparsed_row_indices: tuple[int, ...]
    dimensions_parsed_row_count: int
    retail_price_missing_row_indices: tuple[int, ...]
    trade_price_missing_row_indices: tuple[int, ...]
    lead_time_datetime_row_count: int
    lead_time_populated_row_count: int
    delivery_columns_all_empty: bool
    room_type_vocabulary: Counter[str] = field(default_factory=Counter)
    design_style_vocabulary: Counter[str] = field(default_factory=Counter)
    tags_vocabulary: Counter[str] = field(default_factory=Counter)


def audit_workbook(workbook: WorkbookRows) -> WorkbookAuditReport:
    """Profile every row of `workbook` and retain every anomaly found."""

    rows = workbook.rows
    supplier_counts: Counter[str] = Counter()
    key_occurrences: dict[tuple[str, str], list[tuple[int, str]]] = {}
    source_files: Counter[str] = Counter()
    category_blank_rows: list[int] = []
    junk_category_rows: list[tuple[int, str, str]] = []
    coffee_table_rows = 0
    rug_lighting_rows = 0
    dims_unparsed: list[int] = []
    dims_parsed = 0
    retail_missing: list[int] = []
    trade_missing: list[int] = []
    lead_time_datetime = 0
    lead_time_populated = 0
    room_types: Counter[str] = Counter()
    design_styles: Counter[str] = Counter()
    tags: Counter[str] = Counter()
    mismatch_rows: list[int] = []

    for idx, row in enumerate(rows):
        supplier = str(row[COL_SUPPLIER]).strip() if row[COL_SUPPLIER] else ""
        supplier_counts[supplier] += 1

        sku = str(row[COL_SKU]).strip() if row[COL_SKU] else ""
        dedup_key = (supplier, sku)
        source_file = str(row[COL_SOURCE_FILE]).strip() if row[COL_SOURCE_FILE] else ""
        source_files[source_file] += 1
        key_occurrences.setdefault(dedup_key, []).append((idx, source_file))
        if _source_file_disagrees_with_supplier(
            supplier=supplier, source_file=source_file
        ):
            mismatch_rows.append(idx)

        raw_category = row[COL_CATEGORY]
        category = primary_category(raw_category)
        if category is None:
            category_blank_rows.append(idx)
        else:
            if is_known_junk_category(category):
                junk_category_rows.append((idx, sku, category))
            if category.strip().lower() == "coffee table":
                coffee_table_rows += 1
        name = str(row[COL_NAME]) if row[COL_NAME] else ""
        haystack = f"{raw_category or ''} {name}"
        if _RUG_LIGHTING_PATTERN.search(haystack):
            rug_lighting_rows += 1

        dim_raw = first_non_blank(*(row[c] for c in DIMENSIONS_COLS))
        parsed = parse_dimensions_inches(dim_raw) if dim_raw is not None else None
        if parsed is None:
            dims_unparsed.append(idx)
        else:
            dims_parsed += 1

        if parse_money_decimal(row[COL_RETAIL_PRICE]) is None:
            retail_missing.append(idx)
        trade_raw = first_non_blank(*(row[c] for c in TRADE_PRICE_COLS))
        if parse_money_decimal(trade_raw) is None:
            trade_missing.append(idx)

        lead_time = row[COL_LEAD_TIME]
        if lead_time is not None and not (
            isinstance(lead_time, str) and not lead_time.strip()
        ):
            lead_time_populated += 1
            if is_datetime_like(lead_time):
                lead_time_datetime += 1

        for value, counter in (
            (row[COL_ROOM_TYPE], room_types),
            (row[COL_DESIGN_STYLE], design_styles),
            (row[COL_TAGS], tags),
        ):
            if isinstance(value, str) and value.strip():
                for token in re.split(r"[;,]", value):
                    token = token.strip()
                    if token:
                        counter[token] += 1

    duplicate_findings = tuple(
        DuplicateKeyFinding(
            supplier=key[0],
            sku=key[1],
            occurrences=len(occurrences),
            source_files=tuple(sf for _, sf in occurrences),
        )
        for key, occurrences in key_occurrences.items()
        if len(occurrences) > 1
    )
    def _is_blank(value: object) -> bool:
        return value is None or (isinstance(value, str) and not value.strip())

    delivery_all_empty = all(
        all(_is_blank(row[c]) for row in rows) for c in DELIVERY_COLS
    )

    return WorkbookAuditReport(
        total_rows=len(rows),
        supplier_counts=dict(supplier_counts),
        distinct_supplier_sku_pairs=len(key_occurrences),
        duplicate_key_findings=duplicate_findings,
        source_file_supplier_mismatch_rows=tuple(mismatch_rows),
        distinct_source_files=tuple(sorted(source_files)),
        category_blank_row_indices=tuple(category_blank_rows),
        junk_category_rows=tuple(junk_category_rows),
        coffee_table_row_count=coffee_table_rows,
        rug_lighting_accent_chair_row_count=rug_lighting_rows,
        dimensions_unparsed_row_indices=tuple(dims_unparsed),
        dimensions_parsed_row_count=dims_parsed,
        retail_price_missing_row_indices=tuple(retail_missing),
        trade_price_missing_row_indices=tuple(trade_missing),
        lead_time_datetime_row_count=lead_time_datetime,
        lead_time_populated_row_count=lead_time_populated,
        delivery_columns_all_empty=delivery_all_empty,
        room_type_vocabulary=room_types,
        design_style_vocabulary=design_styles,
        tags_vocabulary=tags,
    )


def _source_file_disagrees_with_supplier(*, supplier: str, source_file: str) -> bool:
    """A row whose `Source File` unambiguously names the *other*
    supplier's sheet is ADR-0005 finding 3's mislabelling pattern (e.g.
    42 Moe's Home rows sourced from `Four Hands Coffee Tables.xlsx`).

    A source file naming **both** suppliers (e.g.
    `Four Hands_Moes Home Beds.xlsx`) is a genuinely mixed sheet, not a
    mislabel, and is deliberately excluded rather than flagged — the
    finding is about attribution being *wrong*, not merely shared.
    """

    lowered = source_file.lower()
    names_four_hands = "four hands" in lowered
    names_moes_home = "moe" in lowered
    if names_four_hands and names_moes_home:
        return False  # mixed sheet name; not attributable to one supplier
    if supplier.lower().startswith("moe") and names_four_hands:
        return True
    if supplier.lower().startswith("four hands") and names_moes_home:
        return True
    return False


def compare_vocabulary_to_mapper(
    observed: Counter[str], canonical: frozenset[str]
) -> dict[str, object]:
    """Diff an observed free-text vocabulary against the mapper file's
    canonical list. This is the "single most useful artefact" comparison
    ADR-0005 names for OQ-009: it does not resolve OQ-009, it just makes
    the drift countable.
    """

    observed_values = set(observed)
    return {
        "observed_distinct": len(observed_values),
        "canonical_distinct": len(canonical),
        "matches_canonical": sorted(observed_values & canonical),
        "not_in_canonical": sorted(observed_values - canonical),
        "canonical_never_observed": sorted(canonical - observed_values),
    }


# Column positions of the canonical lists on the mapper file's
# `SUB-CATEGORIES` sheet (`Quiz and Product Mapper file instruction
# ...xlsx`), zero-based, as laid out in that sheet's own header row.
MAPPER_SUB_CATEGORY_COLUMNS: dict[str, int] = {
    "rooms": 1,
    "design_style": 3,
    "storage_solutions": 5,
    "key_features": 7,
    "furniture_category": 9,
    "tags": 11,
}


def read_mapper_canonical_vocabulary(
    sub_categories_rows: tuple[tuple[object, ...], ...],
) -> dict[str, frozenset[str]]:
    """Extract the mapper file's designer-authored controlled vocabulary
    from the already-read `SUB-CATEGORIES` sheet data rows (header
    excluded, per `WorkbookRows.rows`).

    Each named list occupies its own column with blank padding below the
    shorter lists, so blank cells are simply skipped.
    """

    vocab: dict[str, set[str]] = {name: set() for name in MAPPER_SUB_CATEGORY_COLUMNS}
    for row in sub_categories_rows:
        for name, col in MAPPER_SUB_CATEGORY_COLUMNS.items():
            cell = row[col] if col < len(row) else None
            if isinstance(cell, str) and cell.strip():
                vocab[name].add(cell.strip())
    return {name: frozenset(values) for name, values in vocab.items()}


# OQ-009's six named attributes (`agentic_flow/open_questions.yaml`), used
# only to check presence, never to infer a value from a proxy column.
OQ009_ATTRIBUTES: tuple[str, ...] = (
    "edge_geometry",
    "leg_style_and_height",
    "material_class_anchor_feature_comfort",
    "gloss_level",
    "undertone_temperature",
    "performance_fabric_flag",
)


def oq009_attribute_presence(
    *, workbook_header: tuple[str, ...], mapper_vocab: dict[str, frozenset[str]]
) -> dict[str, bool]:
    """Confirm (never infer) whether each OQ-009 attribute exists as a
    workbook column header or a term in the mapper's controlled
    vocabulary. ADR-0005 already ran this check; this function lets R01
    reproduce it against whatever header/vocab it is given rather than
    take the ADR's finding on faith.

    A `False` result means "not found as a header or vocabulary term" —
    it does not search free-text columns for proxy signals, because a
    proxy match (e.g. a `Tags` value mentioning a material) is exactly
    the guessed default ADR-0005 forbids treating as attribute coverage.
    """

    haystack = {h.strip().lower() for h in workbook_header if h}
    for values in mapper_vocab.values():
        haystack.update(v.strip().lower() for v in values)
    return {attribute: attribute in haystack for attribute in OQ009_ATTRIBUTES}


def serialize_product_sample(
    products: tuple[Product, ...], limit: int = 10
) -> list[dict[str, object]]:
    """Render up to `limit` imported `Product` records as JSON-safe dicts
    for `canonical_sample.json` — the one place `Decimal`/`Millimetres`
    value objects are converted to plain strings/ints for serialization.
    """

    sample: list[dict[str, object]] = []
    for product in products[:limit]:
        sample.append(
            {
                "product_id": product.product_id,
                "supplier_id": product.key.supplier_id,
                "sku": product.key.normalized_sku,
                "name": product.name,
                "category": product.category,
                "availability": str(product.availability),
                "price": (
                    {
                        "amount": str(product.price.amount),
                        "currency": product.price.currency,
                    }
                    if product.price is not None
                    else None
                ),
                "dimensions_mm": (
                    {
                        "width": int(product.dimensions.width_mm),
                        "height": int(product.dimensions.height_mm),
                        "depth": (
                            int(product.dimensions.depth_mm)
                            if product.dimensions.depth_mm is not None
                            else None
                        ),
                    }
                    if product.dimensions is not None
                    else None
                ),
                "source_snapshot_id": product.source_snapshot_id,
            }
        )
    return sample
