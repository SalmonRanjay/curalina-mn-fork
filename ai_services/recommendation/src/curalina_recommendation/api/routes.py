"""`/v1` HTTP surface for the recommendation service — contracts only.

Per A1 ("Contracts" in `agentic_flow/recommendation_workflow.md`), these
handlers return fixture-backed fake responses. There is no catalogue
importer, no ranking, and no bundle solver behind them yet — those are
A2/A3 work against `domain/`, `application/`, `ports/` and `adapters/`,
none of which this module imports. The one exception is the bundle
feasibility split below, which is a deterministic *fixture selector*
(a fixed budget threshold), not a ranking or constraint-solving decision.

Endpoints match the HTTP surface table in
`architecture/guides/03_data_contracts.md`.
"""

from __future__ import annotations

import json
from functools import cache
from importlib import resources
from typing import Any

from fastapi import FastAPI, status
from fastapi.exceptions import RequestValidationError

from curalina_recommendation.api.errors import validation_exception_handler
from curalina_recommendation.api.schemas import (
    BundleRequest,
    BundleResponse,
    CatalogueImportRequest,
    CatalogueImportResponse,
    RecommendationRequest,
    RecommendationResponse,
    SubstitutionRequest,
    SubstitutionResponse,
)

# Below this budget, no known fixture product set can satisfy the
# requested categories. This is a fixed constant used only to pick which
# canned fixture to return -- it is not a budget solver.
INFEASIBLE_BUDGET_THRESHOLD_MINOR_UNITS = 500


@cache
def _load_fixture(name: str) -> dict[str, Any]:
    package = "curalina_recommendation.api.fixtures"
    payload = resources.files(package).joinpath(name).read_text(encoding="utf-8")
    result: dict[str, Any] = json.loads(payload)
    return result


def create_app() -> FastAPI:
    app = FastAPI(title="curalina_recommendation", version="0.0.0")
    app.add_exception_handler(RequestValidationError, validation_exception_handler)

    @app.post(
        "/v1/catalogue/imports",
        response_model=CatalogueImportResponse,
        status_code=status.HTTP_200_OK,
    )
    def create_catalogue_import(
        payload: CatalogueImportRequest,
    ) -> CatalogueImportResponse:
        fixture = _load_fixture("catalogue_imports_success.json")
        return CatalogueImportResponse.model_validate(fixture)

    @app.post(
        "/v1/recommendations",
        response_model=RecommendationResponse,
        status_code=status.HTTP_200_OK,
    )
    def create_recommendations(
        payload: RecommendationRequest,
    ) -> RecommendationResponse:
        fixture = _load_fixture("recommendations_success.json")
        fixture = {**fixture, "catalogue_snapshot_id": payload.catalogue_snapshot_id}
        return RecommendationResponse.model_validate(fixture)

    @app.post(
        "/v1/bundles",
        response_model=BundleResponse,
        status_code=status.HTTP_200_OK,
    )
    def create_bundle(payload: BundleRequest) -> BundleResponse:
        if (
            payload.profile.furniture_budget_minor_units
            < INFEASIBLE_BUDGET_THRESHOLD_MINOR_UNITS
        ):
            fixture = _load_fixture("bundles_infeasible.json")
        else:
            fixture = _load_fixture("bundles_success.json")
        return BundleResponse.model_validate(fixture)

    @app.post(
        "/v1/bundles/{bundle_id}/substitutions",
        response_model=SubstitutionResponse,
        status_code=status.HTTP_200_OK,
    )
    def create_substitution(
        bundle_id: str, payload: SubstitutionRequest
    ) -> SubstitutionResponse:
        fixture = _load_fixture("substitutions_success.json")
        fixture = {**fixture, "original_bundle_id": bundle_id}
        return SubstitutionResponse.model_validate(fixture)

    return app
