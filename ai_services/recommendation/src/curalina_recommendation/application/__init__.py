"""Recommendation application use cases.

Orchestrates domain types through ports; every use case here is callable
identically from a notebook, a test, or (once A3 wires it in) an API route
— per `architecture/guides/08_engineering_and_tests.md`: "framework-neutral
domain and application logic, callable from a notebook and from the API
identically."
"""

from curalina_recommendation.application.bundle_service import BundleService
from curalina_recommendation.application.catalogue_service import CatalogueService
from curalina_recommendation.application.ranking_service import RankingService

__all__ = ["BundleService", "CatalogueService", "RankingService"]
