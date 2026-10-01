"""Initial variants service schema (Postgres).

Mirrors the table shapes the prior SQLite store created ad hoc at startup:
assets, jobs, idempotency_keys, candidates, reviews, masks. JSON payloads
stay as TEXT columns (not JSONB) and binary asset bytes become BYTEA (the
Postgres equivalent of SQLite's BLOB) — callers already serialize/deserialize
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
        "assets",
        sa.Column("asset_id", sa.Text(), primary_key=True),
        sa.Column("record_json", sa.Text(), nullable=False),
        sa.Column("content_bytes", sa.LargeBinary(), nullable=False),
    )
    op.create_table(
        "jobs",
        sa.Column("job_id", sa.Text(), primary_key=True),
        sa.Column("record_json", sa.Text(), nullable=False),
        sa.Column("request_json", sa.Text(), nullable=False),
        sa.Column("lease_owner", sa.Text(), nullable=True),
        sa.Column("leased_until", sa.Text(), nullable=True),
    )
    op.create_table(
        "idempotency_keys",
        sa.Column("owner_id", sa.Text(), nullable=False),
        sa.Column("operation", sa.Text(), nullable=False),
        sa.Column("idempotency_key", sa.Text(), nullable=False),
        sa.Column("request_hash", sa.Text(), nullable=False),
        sa.Column("job_id", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint(
            "owner_id", "operation", "idempotency_key", name="pk_idempotency_keys"
        ),
    )
    op.create_table(
        "candidates",
        sa.Column("candidate_id", sa.Text(), primary_key=True),
        sa.Column("record_json", sa.Text(), nullable=False),
    )
    op.create_table(
        "reviews",
        sa.Column("review_id", sa.Text(), primary_key=True),
        sa.Column("candidate_id", sa.Text(), nullable=False),
        sa.Column("record_json", sa.Text(), nullable=False),
    )
    op.create_table(
        "masks",
        sa.Column("mask_id", sa.Text(), primary_key=True),
        sa.Column("record_json", sa.Text(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("masks")
    op.drop_table("reviews")
    op.drop_table("candidates")
    op.drop_table("idempotency_keys")
    op.drop_table("jobs")
    op.drop_table("assets")
