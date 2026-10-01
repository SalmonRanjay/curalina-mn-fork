"""Initial rooms service schema (Postgres).

Mirrors the table shapes the prior SQLite store created ad hoc at startup:
bundles, assets, jobs, candidates, reviews, staged_insertions. JSON payloads
stay as TEXT columns (not JSONB) — callers already serialize/deserialize
these payloads themselves, so this is a behavior-preserving storage swap.

Revision ID: 0001
Revises:
Create Date: 2026-09-30
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "bundles",
        sa.Column("bundle_id", sa.Text(), primary_key=True),
        sa.Column("current_revision", sa.Text(), nullable=False),
    )
    op.create_table(
        "assets",
        sa.Column("asset_id", sa.Text(), primary_key=True),
        sa.Column("record_json", sa.Text(), nullable=False),
    )
    op.create_table(
        "jobs",
        sa.Column("job_id", sa.Text(), primary_key=True),
        sa.Column("record_json", sa.Text(), nullable=False),
        sa.Column("request_json", sa.Text(), nullable=False),
        sa.Column("max_attempts", sa.Integer(), nullable=False),
        sa.Column("failure_after_insertions", sa.Integer(), nullable=True),
        sa.Column("lease_owner", sa.Text(), nullable=True),
        sa.Column("leased_until", sa.Text(), nullable=True),
    )
    op.create_table(
        "candidates",
        sa.Column("candidate_id", sa.Text(), primary_key=True),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("record_json", sa.Text(), nullable=False),
    )
    op.create_table(
        "reviews",
        sa.Column("review_id", sa.Text(), primary_key=True),
        sa.Column("candidate_id", sa.Text(), nullable=False),
        sa.Column("record_json", sa.Text(), nullable=False),
    )
    op.create_table(
        "staged_insertions",
        sa.Column("job_id", sa.Text(), nullable=False),
        sa.Column("stage_index", sa.Integer(), nullable=False),
        sa.Column("instance_id", sa.Text(), nullable=False),
        sa.Column("artifact_asset_id", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint(
            "job_id", "stage_index", name="pk_staged_insertions"
        ),
    )


def downgrade() -> None:
    op.drop_table("staged_insertions")
    op.drop_table("reviews")
    op.drop_table("candidates")
    op.drop_table("jobs")
    op.drop_table("assets")
    op.drop_table("bundles")
