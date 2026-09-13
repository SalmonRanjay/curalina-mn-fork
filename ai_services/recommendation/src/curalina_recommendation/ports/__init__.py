"""Recommendation service ports.

Interfaces only (typing.Protocol) — no implementation lives here. See each
module's docstring for which workflow step and notebook gate its real
implementation is blocked on; `adapters/` holds the fake implementations
that exist today.
"""

from curalina_recommendation.ports.bundle_composer import BundleComposer
from curalina_recommendation.ports.catalogue_importer import CatalogueImporter
from curalina_recommendation.ports.feature_encoder import FeatureEncoder

__all__ = ["BundleComposer", "CatalogueImporter", "FeatureEncoder"]
