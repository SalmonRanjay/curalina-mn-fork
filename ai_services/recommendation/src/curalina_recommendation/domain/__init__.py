"""Pure recommendation domain records and functions.

No framework imports, no I/O, no settings reads, no pandas DataFrame ever
crosses into this package (per `architecture/guides/08_engineering_and_tests.md`
and `agent_instructions/01_recommendation_service.md`).
"""

from curalina_recommendation.domain.bundle import Bundle, BundleLineItem
from curalina_recommendation.domain.catalogue import (
    CatalogueImportReport,
    CatalogueSnapshot,
)
from curalina_recommendation.domain.dimensions import (
    MM_PER_INCH,
    Clearance,
    Dimensions,
    Millimetres,
    inches_to_mm,
)
from curalina_recommendation.domain.eligibility import Availability, EligibilityReason
from curalina_recommendation.domain.errors import (
    CurrencyMismatchError,
    DomainError,
    DuplicateProductKeyError,
    InvalidSkuError,
    MissingRequiredFactError,
)
from curalina_recommendation.domain.money import Money, sum_money
from curalina_recommendation.domain.product import Product, ProductKey
from curalina_recommendation.domain.profile import Profile
from curalina_recommendation.domain.ranking import RankedCandidate

__all__ = [
    "MM_PER_INCH",
    "Availability",
    "Bundle",
    "BundleLineItem",
    "CatalogueImportReport",
    "CatalogueSnapshot",
    "Clearance",
    "CurrencyMismatchError",
    "Dimensions",
    "DomainError",
    "DuplicateProductKeyError",
    "EligibilityReason",
    "InvalidSkuError",
    "MissingRequiredFactError",
    "Millimetres",
    "Money",
    "Product",
    "ProductKey",
    "Profile",
    "RankedCandidate",
    "inches_to_mm",
    "sum_money",
]
