"""`Product` and its compound identity key.

Per `architecture/guides/03_data_contracts.md`'s "Core records": "Product:
schema_version, product_id, supplier_id, supplier_sku, category,
collection_id, name, attributes, dimensions, retail_price, trade_price,
availability, asset_refs, source_snapshot_id and review status." A0/A2's
scope for this packet keeps the fields the mandatory named tests and the
fake adapters actually exercise; unused optional fields (asset_refs,
review status, collection_id) are deliberately omitted rather than
speculatively stubbed, and can be added additively when the importer that
needs them is built (workflow step 2, blocked on R01).
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field

from curalina_recommendation.domain.dimensions import Dimensions
from curalina_recommendation.domain.eligibility import Availability
from curalina_recommendation.domain.errors import (
    InvalidSkuError,
    MissingRequiredFactError,
)
from curalina_recommendation.domain.money import Money

_WHITESPACE_RUN = re.compile(r"\s+")


@dataclass(frozen=True, slots=True)
class ProductKey:
    """The compound identity key `03_data_contracts.md` requires:
    supplier_id plus supplier_sku, with Unicode whitespace normalized for
    comparison while the original SKU is retained for display.

    Equality/hash are based on `(supplier_id, normalized_sku)` only —
    `raw_sku` is excluded from both, since two records whose SKUs differ
    only in whitespace/Unicode form are the same compound key per
    `03_data_contracts.md` ("reject duplicate compound keys").
    """

    supplier_id: str
    normalized_sku: str
    raw_sku: str = field(compare=False)

    @classmethod
    def build(cls, *, supplier_id: str, raw_sku: str) -> ProductKey:
        supplier_id = supplier_id.strip()
        if not supplier_id:
            raise ValueError("supplier_id must not be blank")
        normalized = unicodedata.normalize("NFKC", raw_sku)
        normalized = _WHITESPACE_RUN.sub(" ", normalized).strip()
        if not normalized:
            raise InvalidSkuError(raw_sku)
        return cls(
            supplier_id=supplier_id, normalized_sku=normalized, raw_sku=raw_sku
        )


@dataclass(frozen=True, slots=True)
class Product:
    """A single catalogue product as a pure, framework-neutral record.

    `price` and `dimensions` are `None` only when the source genuinely
    lacked the fact; in that case `availability` must be `UNKNOWN`
    (enforced below) so a downstream ranking/bundle step can never treat a
    missing fact as a confirmed `AVAILABLE` product.

    `overview` is supplier-authored descriptive prose (the workbook's
    `Overview` column), added additively by ADR-0007 as the encoder-visible
    text surface R02 needs. It is deliberately the *only* text field here:
    ADR-0006 §D2 requires the label-source fields (`Room Type`,
    `Design Style`, `Tags`) to be structurally absent from anything a
    `FeatureEncoder` can reach, so the rule-only baseline cannot win by
    reading the column its own labels are derived from. Do not add those
    three fields, and do not add a free-form `attributes` bag that could
    carry them — see ADR-0007 for why that shape was rejected.
    """

    product_id: str
    key: ProductKey
    category: str
    name: str
    availability: Availability
    price: Money | None = None
    dimensions: Dimensions | None = None
    source_snapshot_id: str | None = None
    overview: str | None = None
    # Set to `adapters.logic_only_bundle_composer.SYNTHETIC_FIXTURE_LABEL`
    # for labelled-synthetic fixture products only; `None` for every real
    # catalogue import. The composer uses this, not `source_snapshot_id`,
    # to gate the `real_catalogue_composition` violation per `ADR-0013`.
    fixture_label: str | None = None

    def __post_init__(self) -> None:
        if not self.product_id.strip():
            raise ValueError("product_id must not be blank")
        if not self.category.strip():
            raise ValueError("category must not be blank")
        if self.overview is not None and not self.overview.strip():
            raise ValueError(
                "overview must be None when absent, not blank — "
                "a blank string would let an encoder treat a missing "
                "fact as empty text (ADR-0007)"
            )
        if self.availability is Availability.AVAILABLE:
            if self.price is None:
                raise MissingRequiredFactError(self.product_id, "price")
            if self.dimensions is None:
                raise MissingRequiredFactError(self.product_id, "dimensions")
