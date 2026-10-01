"""Initial recommendation service schema (Postgres).

Mirrors the table shapes the prior SQLite store created ad hoc at startup:
catalogue_snapshots, rule_versions, bundles. JSON payloads stay as TEXT
columns (not JSONB) to keep the storage-backend swap behavior-preserving —
callers already serialize/deserialize these payloads themselves.

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
        "catalogue_snapshots",
        sa.Column("snapshot_id", sa.Text(), primary_key=True),
        sa.Column("supplier_id", sa.Text(), nullable=False),
        sa.Column("products_json", sa.Text(), nullable=False),
        sa.Column("report_json", sa.Text(), nullable=False),
    )
    op.create_table(
        "rule_versions",
        sa.Column("rules_version", sa.Text(), primary_key=True),
    )
    op.create_table(
        "bundles",
        sa.Column("bundle_id", sa.Text(), primary_key=True),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("payload_json", sa.Text(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("bundles")
    op.drop_table("rule_versions")
    op.drop_table("catalogue_snapshots")
