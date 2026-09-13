"""Unit tests for the R01 audit/profiling logic.

Uses a small synthetic `WorkbookRows` shaped like the real workbook's
columns rather than the real `attached_assets` file, so this suite stays
fast and offline. The real file's counts (385 rows, 42 duplicates, one
junk category row, etc.) are reproduced and reported by the R01 notebook
itself, which calls these same functions against the pinned file.
"""

from __future__ import annotations

from collections import Counter
from decimal import Decimal
from pathlib import Path

from curalina_recommendation.adapters.xlsx_workbook_reader import WorkbookRows
from curalina_recommendation.application.catalogue_audit_service import (
    OQ009_ATTRIBUTES,
    audit_workbook,
    compare_vocabulary_to_mapper,
    oq009_attribute_presence,
    read_mapper_canonical_vocabulary,
    serialize_product_sample,
)
from curalina_recommendation.domain.dimensions import Dimensions
from curalina_recommendation.domain.eligibility import Availability
from curalina_recommendation.domain.money import Money
from curalina_recommendation.domain.product import Product, ProductKey

_HEADER = tuple(f"col{i}" for i in range(36))


def _row(
    *,
    name: str = "Product",
    supplier: str = "Four Hands",
    sku: str = "SKU-1",
    retail_price: object = 100,
    trade_price_a: object = None,
    trade_price_b: object = None,
    category: object = "Sofa",
    dims_moes: object = None,
    dims_four_hands: object = None,
    source_file: str = "Four Hands Sofas.xlsx",
    lead_time: object = None,
    room_type: object = None,
    design_style: object = None,
    tags: object = None,
) -> tuple[object, ...]:
    row: list[object] = [None] * 36
    row[0] = name
    row[2] = supplier
    row[3] = sku
    row[4] = trade_price_a
    row[5] = retail_price
    row[6] = category
    row[7] = room_type
    row[8] = design_style
    row[11] = dims_moes
    row[21] = lead_time
    row[26] = tags
    row[27] = source_file
    row[28] = trade_price_b
    row[29] = dims_four_hands
    return tuple(row)


def _workbook(rows: list[tuple[object, ...]]) -> WorkbookRows:
    return WorkbookRows(
        source_path=Path("synthetic.xlsx"),
        source_md5="deadbeef",
        sheet_name="Sheet1",
        header=_HEADER,
        rows=tuple(rows),
    )


def test_supplier_counts_and_distinct_pairs() -> None:
    workbook = _workbook(
        [
            _row(sku="A", supplier="Four Hands"),
            _row(sku="B", supplier="Moes Home"),
            _row(sku="B", supplier="Moes Home"),  # duplicate compound key
        ]
    )

    report = audit_workbook(workbook)

    assert report.total_rows == 3
    assert report.supplier_counts == {"Four Hands": 1, "Moes Home": 2}
    assert report.distinct_supplier_sku_pairs == 2
    assert len(report.duplicate_key_findings) == 1
    assert report.duplicate_key_findings[0].occurrences == 2


def test_source_file_mislabel_is_flagged_but_mixed_sheet_is_not() -> None:
    workbook = _workbook(
        [
            _row(
                sku="A",
                supplier="Moes Home",
                source_file="Four Hands Coffee Tables.xlsx",
            ),
            _row(
                sku="B",
                supplier="Moes Home",
                source_file="Four Hands_Moes Home Beds.xlsx",
            ),
            _row(sku="C", supplier="Four Hands", source_file="Four Hands Sofas.xlsx"),
        ]
    )

    report = audit_workbook(workbook)

    assert report.source_file_supplier_mismatch_rows == (0,)


def test_blank_and_junk_category_rows_are_retained() -> None:
    workbook = _workbook(
        [
            _row(sku="A", category=None),
            _row(sku="B", category="Final CSV-Ready Summary"),
            _row(sku="C", category="Sofa"),
        ]
    )

    report = audit_workbook(workbook)

    assert report.category_blank_row_indices == (0,)
    assert report.junk_category_rows == ((1, "B", "Final CSV-Ready Summary"),)


def test_dimensions_parse_rate_counts_both_formats_and_failures() -> None:
    workbook = _workbook(
        [
            _row(sku="A", dims_moes="10” W X 12” D X 14” H"),
            _row(sku="B", dims_four_hands='10"w x 12"d x 14"h'),
            _row(sku="C", dims_moes=None, dims_four_hands=None),
        ]
    )

    report = audit_workbook(workbook)

    assert report.dimensions_parsed_row_count == 2
    assert report.dimensions_unparsed_row_indices == (2,)


def test_lead_time_datetime_vs_populated_counts() -> None:
    import datetime

    workbook = _workbook(
        [
            _row(sku="A", lead_time=datetime.date(2025, 11, 3)),
            _row(sku="B", lead_time="4-6 weeks"),
            _row(sku="C", lead_time=None),
        ]
    )

    report = audit_workbook(workbook)

    assert report.lead_time_populated_row_count == 2
    assert report.lead_time_datetime_row_count == 1


def test_delivery_columns_all_empty_true_when_every_row_blank() -> None:
    workbook = _workbook([_row(sku="A"), _row(sku="B")])

    report = audit_workbook(workbook)

    assert report.delivery_columns_all_empty is True


def test_vocabulary_tokenization_splits_on_comma_and_semicolon() -> None:
    workbook = _workbook(
        [
            _row(sku="A", room_type="Living room; Home Office"),
            _row(sku="B", room_type="Living Room, Bedroom"),
        ]
    )

    report = audit_workbook(workbook)

    assert report.room_type_vocabulary["Living room"] == 1
    assert report.room_type_vocabulary["Home Office"] == 1
    assert report.room_type_vocabulary["Living Room"] == 1
    assert report.room_type_vocabulary["Bedroom"] == 1


def test_compare_vocabulary_to_mapper_reports_drift_both_directions() -> None:
    observed: Counter[str] = Counter({"Sofa": 5, "Warm Transittional": 2})
    canonical = frozenset({"Sofa", "Coffee Table"})

    diff = compare_vocabulary_to_mapper(observed, canonical)

    assert diff["matches_canonical"] == ["Sofa"]
    assert diff["not_in_canonical"] == ["Warm Transittional"]
    assert diff["canonical_never_observed"] == ["Coffee Table"]


def test_read_mapper_canonical_vocabulary_extracts_named_columns() -> None:
    rows: tuple[tuple[object, ...], ...] = (
        (None, "Living room", None, "Mid-Century Scandi", None, "Open Storage",
         None, "Workspace Area", None, "Sofa", None, "Calm/Serene"),
        (None, "Dining room", None, "Modern Farmhouse", None, None,
         None, None, None, "Sectional", None, None),
    )

    vocab = read_mapper_canonical_vocabulary(rows)

    assert vocab["rooms"] == frozenset({"Living room", "Dining room"})
    assert vocab["furniture_category"] == frozenset({"Sofa", "Sectional"})
    assert vocab["tags"] == frozenset({"Calm/Serene"})


def test_oq009_attributes_are_absent_from_header_and_vocab() -> None:
    header = ("Product Name", "Supplier", "SKU", "Furniture Category", "Tags")
    mapper_vocab = {
        "furniture_category": frozenset({"Sofa", "Coffee Table"}),
        "tags": frozenset({"Calm/Serene", "Velvet/Brass/Smoked Glass"}),
    }

    presence = oq009_attribute_presence(
        workbook_header=header, mapper_vocab=mapper_vocab
    )

    assert set(presence) == set(OQ009_ATTRIBUTES)
    assert all(found is False for found in presence.values())


def test_oq009_attribute_present_when_named_verbatim() -> None:
    # Guards against the function silently matching proxy text: it must
    # only fire on an exact attribute-name token, not a material mention.
    header = ("gloss_level",)

    presence = oq009_attribute_presence(workbook_header=header, mapper_vocab={})

    assert presence["gloss_level"] is True
    assert presence["edge_geometry"] is False


def test_serialize_product_sample_is_json_safe_and_respects_limit() -> None:
    products = tuple(
        Product(
            product_id=f"prod-{i}",
            key=ProductKey.build(supplier_id="Four Hands", raw_sku=f"SKU-{i}"),
            category="Sofa",
            name=f"Sofa {i}",
            availability=Availability.UNKNOWN,
            price=Money(Decimal("199"), "XXX"),
            dimensions=Dimensions.from_inches(
                width_in=Decimal("30"), height_in=Decimal("40")
            ),
        )
        for i in range(3)
    )

    sample = serialize_product_sample(products, limit=2)

    assert len(sample) == 2
    assert sample[0]["price"] == {"amount": "199", "currency": "XXX"}
    assert sample[0]["dimensions_mm"]["depth"] is None
    assert isinstance(sample[0]["dimensions_mm"]["width"], int)
