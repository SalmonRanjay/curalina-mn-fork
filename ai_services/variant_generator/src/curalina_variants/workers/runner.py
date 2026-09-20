"""Worker entry points for durable variant jobs."""

from __future__ import annotations

import base64
from dataclasses import dataclass

from curalina_variants.adapters.lab_colour_transfer import LabColourTransferAdapter
from curalina_variants.api.errors import ApiError
from curalina_variants.api.schemas import ErrorSummary, JobRecord
from curalina_variants.api.sqlite_store import SQLiteJobStore
from curalina_variants.domain.colour_spec import RgbColour
from curalina_variants.domain.mask_spec import Mask, Region
from curalina_variants.settings import Settings


@dataclass(frozen=True, slots=True)
class WorkerResult:
    processed: bool
    job: JobRecord | None = None


def _mask_record_to_domain_mask(
    mask_id: str,
    source_asset_id: str,
    width_px: int,
    height_px: int,
    editable_mask_b64: str,
    protected_subregions: list[dict[str, int]],
    feather_band_px: int,
    human_corrected: bool,
    revision: int,
) -> Mask:
    """Convert MaskRecord fields to Mask domain type."""
    editable_mask = base64.b64decode(editable_mask_b64)
    return Mask(
        mask_id=mask_id,
        source_asset_id=source_asset_id,
        width_px=width_px,
        height_px=height_px,
        editable_mask=editable_mask,
        protected_subregions=tuple(
            Region(
                x_px=r["x_px"],
                y_px=r["y_px"],
                width_px=r["width_px"],
                height_px=r["height_px"],
            )
            for r in protected_subregions
        ),
        feather_px=feather_band_px,
        human_corrected=human_corrected,
        revision=revision,
    )


def process_one_job(
    store: SQLiteJobStore,
    *,
    worker_id: str,
    lease_seconds: int,
) -> WorkerResult:
    job = store.lease_next_job(worker_id=worker_id, lease_seconds=lease_seconds)
    if job is None:
        return WorkerResult(processed=False)

    # Try to perform real transformation
    output_asset_bytes = None
    error_summary = None
    request_id = "worker"

    try:
        # Get the job request to access mask_id and source_asset_id
        request = store.get_job_request(job.job_id, request_id=request_id)

        # Get the mask and source asset content
        mask_record = store.get_mask(request.mask_id, request_id=request_id)
        source_asset = store.get_asset_content(
            request.source_asset_id, request_id=request_id
        )

        # Convert mask record to domain type
        domain_mask = _mask_record_to_domain_mask(
            mask_id=mask_record.mask_id,
            source_asset_id=mask_record.source_asset_id,
            width_px=mask_record.width_px,
            height_px=mask_record.height_px,
            editable_mask_b64=mask_record.editable_mask_b64,
            protected_subregions=[
                {
                    "x_px": r.x_px,
                    "y_px": r.y_px,
                    "width_px": r.width_px,
                    "height_px": r.height_px,
                }
                for r in mask_record.protected_subregions
            ],
            feather_band_px=mask_record.feather_band_px,
            human_corrected=mask_record.human_corrected,
            revision=mask_record.revision,
        )

        # Parse target colour
        target_colour = RgbColour.from_hex(request.target_colour)

        # Perform the real transformation
        adapter = LabColourTransferAdapter()
        result = adapter.transfer(
            source_asset.content_bytes,
            domain_mask,
            target_colour,
        )
        output_asset_bytes = result.image_bytes
    except ApiError as e:
        # Resource not found (mask or asset) or other API-level errors
        if e.body.code == "not_found":
            # Determine which resource was not found from error message
            if "mask" in e.body.message.lower():
                error_summary = ErrorSummary(
                    code="transform_mask_not_found",
                    message=f"Mask not found during transformation: {e.body.message}",
                )
            elif "asset" in e.body.message.lower():
                error_summary = ErrorSummary(
                    code="transform_asset_not_found",
                    message=f"Asset not found during transformation: {e.body.message}",
                )
            else:
                error_summary = ErrorSummary(
                    code="transform_resource_not_found",
                    message=f"Required resource not found: {e.body.message}",
                )
        else:
            error_summary = ErrorSummary(
                code="transform_api_error",
                message=f"API error during transformation: {e.body.message}",
            )
    except ValueError as e:
        # Invalid colour format or dimension mismatch
        if "colour" in str(e).lower() or "hex" in str(e).lower():
            error_summary = ErrorSummary(
                code="transform_invalid_colour",
                message=f"Invalid target colour: {str(e)}",
            )
        elif "dimension" in str(e).lower():
            error_summary = ErrorSummary(
                code="transform_dimension_mismatch",
                message=f"Mask and image dimensions do not match: {str(e)}",
            )
        else:
            error_summary = ErrorSummary(
                code="transform_invalid_input",
                message=f"Invalid input during transformation: {str(e)}",
            )
    except Exception as e:
        # Catch adapter failures and other unexpected errors
        error_summary = ErrorSummary(
            code="transform_adapter_failure",
            message=f"Colour transfer adapter failed: {type(e).__name__}: {str(e)}",
        )

    # Complete the job: either with real output or as failed with error
    if error_summary is not None:
        # Mark job as failed with the captured error
        completed = store.complete_leased_job(
            job.job_id,
            worker_id=worker_id,
            outcome="failed",
            request_id=request_id,
            output_asset_bytes=None,
            failure_summary=error_summary,
        )
    else:
        # Complete successfully with real output
        completed = store.complete_leased_job(
            job.job_id,
            worker_id=worker_id,
            output_asset_bytes=output_asset_bytes,
        )
    return WorkerResult(processed=True, job=completed)


def run_worker_once(settings: Settings, *, worker_id: str = "worker_local") -> int:
    store = SQLiteJobStore.from_database_url(settings.curalina_database_url)
    store.initialize()
    result = process_one_job(
        store,
        worker_id=worker_id,
        lease_seconds=settings.curalina_job_timeout_seconds,
    )
    return 0 if result.processed else 1
