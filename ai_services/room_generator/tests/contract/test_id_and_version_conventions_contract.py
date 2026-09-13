"""Cross-service ID/version conventions from `contracts/v1/id_versioning.md`.

These are re-asserted here (not just in `ai_services/contracts/tests/`)
because `contracts-qa-steward` checks each service's own responses, not
just the shared documentation.
"""

from curalina_rooms.api.fixtures import load_fixture
from curalina_rooms.api.schemas import SCHEMA_VERSION
from curalina_rooms.api.service import RoomsContractService


def test_default_schema_version_is_1_0() -> None:
    assert SCHEMA_VERSION == "1.0"


def test_response_ids_use_the_documented_prefixes() -> None:
    service = RoomsContractService()

    job = service.create_render_job(load_fixture("render_job_request_valid.json"))
    assert job.body.job_id.startswith("job_")

    asset = service.import_asset(load_fixture("asset_import_request.json"))
    assert asset.body.asset_id.startswith("asset_")

    review = service.create_candidate_review(
        "cand_render000001", load_fixture("candidate_review_request.json")
    )
    assert review.body.candidate_id.startswith("cand_")


def test_seeded_asset_content_hash_uses_lowercase_sha256_prefix() -> None:
    service = RoomsContractService()

    content = service.get_asset_content("asset_room000001")

    assert content.body.content_hash.startswith("sha256:")
    hex_part = content.body.content_hash.split(":", 1)[1]
    assert hex_part == hex_part.lower()
    assert len(hex_part) == 64
