"""Recommendation infrastructure adapters.

Every adapter in this package today is a FAKE ADAPTER (see each module's
docstring for exactly which real-logic step it stands in for, and which
notebook gate blocks the real implementation). None of them should be
mistaken for an accepted implementation of the port they satisfy.
"""

from curalina_recommendation.adapters.fake_bundle_composer import FakeBundleComposer
from curalina_recommendation.adapters.fake_catalogue_importer import (
    FakeCatalogueImporter,
)
from curalina_recommendation.adapters.fake_feature_encoder import FakeFeatureEncoder

__all__ = ["FakeBundleComposer", "FakeCatalogueImporter", "FakeFeatureEncoder"]
