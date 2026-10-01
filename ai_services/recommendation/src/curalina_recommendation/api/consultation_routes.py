"""`POST /v1/consultation/recommendations` (`ADR-0025`).

The recommender (catalogue + model) is built lazily on the first request and
cached, so the service still starts, and every other endpoint still works,
when the supplier workbooks are not mounted. In that case this endpoint
fails closed with 503 `catalogue_not_configured` / `catalogue_unavailable`.
"""

from __future__ import annotations

import logging
import threading
from collections.abc import Callable

from fastapi import FastAPI
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse

from curalina_recommendation.api.errors import build_error
from curalina_recommendation.api.schemas import (
    ConsultationModelOut,
    ConsultationPlacementOut,
    ConsultationProductOut,
    ConsultationRecommendationRequest,
    ConsultationRecommendationResponse,
)
from curalina_recommendation.consultation.catalogue import (
    CatalogueNotFoundError,
    load_catalogue,
)
from curalina_recommendation.consultation.model import TwoTowerScorer
from curalina_recommendation.consultation.quiz import ConsultationAnswers
from curalina_recommendation.consultation.recommender import (
    ConsultationRecommender,
    NeedsInput,
    ScoredProduct,
)
from curalina_recommendation.settings import Settings

logger = logging.getLogger(__name__)

RecommenderProvider = Callable[[], ConsultationRecommender]


class CatalogueNotConfiguredError(Exception):
    pass


def _minor_units(amount: float | None) -> int | None:
    return None if amount is None else round(amount * 100)


def settings_provider(settings: Settings) -> RecommenderProvider:
    """Build once on first use; a failed build is retried on the next request."""
    lock = threading.Lock()
    cache: list[ConsultationRecommender] = []

    def provide() -> ConsultationRecommender:
        if cache:
            return cache[0]
        with lock:
            if cache:
                return cache[0]
            if settings.curalina_supplier_data_dir is None:
                raise CatalogueNotConfiguredError(
                    "CURALINA_SUPPLIER_DATA_DIR is not set, so there is no "
                    "catalogue to recommend from."
                )
            catalogue = load_catalogue(settings.curalina_supplier_data_dir)
            scorer = TwoTowerScorer.load(settings.curalina_recommender_model_dir)
            recommender = ConsultationRecommender(
                catalogue, scorer, min_match_score=settings.curalina_min_match_score
            )
            report = catalogue.report
            logger.info(
                "consultation recommender ready: %d products (%d rows read, "
                "%d without category/name, %d without tags), model %s sha256 %s, "
                "catalogue fingerprint %s",
                len(catalogue.products),
                report.rows_loaded,
                report.dropped_no_category_or_name,
                report.dropped_no_tags,
                scorer.info.trained_run,
                scorer.info.weights_sha256[:12],
                report.fingerprint[:12],
            )
            cache.append(recommender)
            return recommender

    return provide


def _product_out(scored: ScoredProduct) -> ConsultationProductOut:
    p = scored.product
    return ConsultationProductOut(
        product_id=p.product_id,
        supplier=p.supplier,
        sku=p.sku,
        name=p.display_name,
        category=p.category,
        unit_price_minor_units=_minor_units(p.price),
        match_score=min(1.0, max(0.0, scored.match_score)),
        rule_match=scored.rule_match,
        rooms=list(p.rooms),
        styles=list(p.styles),
        atmospheres=list(p.atmospheres),
    )


def _error(status: int, code: str, message: str, retryable: bool) -> JSONResponse:
    error = build_error(code=code, message=message, retryable=retryable)
    return JSONResponse(status_code=status, content=jsonable_encoder(error))


def register_consultation_routes(
    app: FastAPI,
    provider: RecommenderProvider,
    *,
    currency: str,
    min_match_score: float,
) -> None:
    @app.post(
        "/v1/consultation/recommendations",
        response_model=ConsultationRecommendationResponse,
    )
    def create_consultation_recommendation(
        payload: ConsultationRecommendationRequest,
    ) -> ConsultationRecommendationResponse | JSONResponse:
        try:
            recommender = provider()
        except CatalogueNotConfiguredError as exc:
            return _error(503, "catalogue_not_configured", str(exc), False)
        except (CatalogueNotFoundError, OSError, ValueError) as exc:
            logger.exception("consultation recommender failed to load")
            return _error(
                503,
                "catalogue_unavailable",
                f"Catalogue or model failed to load: {exc}",
                True,
            )

        a = payload.answers
        answers = ConsultationAnswers(
            room_type=a.room_type,
            aesthetic=a.aesthetic,
            materiality=a.materiality,
            atmosphere=a.atmosphere,
            pattern_preference=a.pattern_preference,
            practical_touches=tuple(a.practical_touches),
            seating_capacity=a.seating_capacity,
            bed_size=a.bed_size,
            investment=a.investment,
        )
        model_out = ConsultationModelOut(
            family=recommender.model.family,
            weights_sha256=recommender.model.weights_sha256,
            trained_run=recommender.model.trained_run,
            min_match_score=min_match_score,
        )
        result = recommender.recommend(answers)
        if isinstance(result, NeedsInput):
            return ConsultationRecommendationResponse(
                status="needs_input",
                problems=list(result.problems),
                currency=currency,
                model=model_out,
                catalogue_fingerprint=recommender.catalogue.report.fingerprint,
            )
        return ConsultationRecommendationResponse(
            status="ok",
            room_type=result.room,
            currency=currency,
            placements=[
                ConsultationPlacementOut(
                    slot_id=p.slot_id,
                    tier=p.tier,  # type: ignore[arg-type]
                    label=p.label,
                    quantity=p.quantity,
                    quantity_source=p.quantity_source,
                    line_total_minor_units=round(p.line_total * 100),
                    product=_product_out(p.scored),
                )
                for p in result.placements
            ],
            alternatives={
                slot: [_product_out(s) for s in options]
                for slot, options in result.alternatives.items()
            },
            total_minor_units=round(result.total * 100),
            budget_ceiling_minor_units=_minor_units(result.ceiling),
            notes=list(result.notes),
            not_in_catalogue=list(result.not_in_catalogue),
            plan_source=result.plan_source,
            model=model_out,
            catalogue_fingerprint=result.catalogue_fingerprint,
            products_scored=result.products_scored,
            model_rule_disagreements=result.model_rule_disagreements,
        )
