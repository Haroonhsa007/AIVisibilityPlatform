"""Initial backend schema

Revision ID: 0001
Revises:
Create Date: 2026-11-04 11:47:36.062653

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "business_profiles",
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("domain", sa.String(length=253), nullable=False),
        sa.Column("industry", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("competitors", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("uuid", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "status IN ('new', 'running', 'completed', 'failed')",
            name=op.f("ck_business_profiles_status"),
        ),
        sa.PrimaryKeyConstraint("uuid", name=op.f("pk_business_profiles")),
    )
    # SQLite autogeneration cannot reflect expression indexes; declare explicitly.
    op.create_index(
        "uq_business_profiles_domain_lower",
        "business_profiles",
        [sa.text("lower(domain)")],
        unique=True,
    )
    op.create_table(
        "pipeline_runs",
        sa.Column("profile_uuid", sa.Uuid(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("stage", sa.String(length=20), nullable=True),
        sa.Column("queries_discovered", sa.Integer(), nullable=False),
        sa.Column("queries_scored", sa.Integer(), nullable=False),
        sa.Column("recommendations_created", sa.Integer(), nullable=False),
        sa.Column("tokens_used", sa.Integer(), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("uuid", sa.Uuid(), nullable=False),
        sa.CheckConstraint(
            "stage IN ('discovery', 'scoring', 'recommendations')",
            name=op.f("ck_pipeline_runs_stage"),
        ),
        sa.CheckConstraint(
            "status IN ('queued', 'running', 'completed', 'partial', 'failed')",
            name=op.f("ck_pipeline_runs_status"),
        ),
        sa.ForeignKeyConstraint(
            ["profile_uuid"],
            ["business_profiles.uuid"],
            name=op.f("fk_pipeline_runs_profile_uuid_business_profiles"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("uuid", name=op.f("pk_pipeline_runs")),
    )
    with op.batch_alter_table("pipeline_runs", schema=None) as batch_op:
        batch_op.create_index(
            "ix_pipeline_runs_profile_created",
            ["profile_uuid", sa.literal_column("created_at DESC")],
            unique=False,
        )

    op.create_table(
        "discovered_queries",
        sa.Column("profile_uuid", sa.Uuid(), nullable=False),
        sa.Column("run_uuid", sa.Uuid(), nullable=False),
        sa.Column("query_text", sa.Text(), nullable=False),
        sa.Column("estimated_search_volume", sa.Integer(), nullable=True),
        sa.Column("competitive_difficulty", sa.Integer(), nullable=True),
        sa.Column("opportunity_score", sa.Float(), nullable=True),
        sa.Column("domain_visible", sa.Boolean(), nullable=True),
        sa.Column("visibility_position", sa.Integer(), nullable=True),
        sa.Column("discovered_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cited_domains", sa.JSON(), nullable=False),
        sa.Column("score_components", sa.JSON(), nullable=False),
        sa.Column("uuid", sa.Uuid(), nullable=False),
        sa.CheckConstraint(
            "competitive_difficulty BETWEEN 0 AND 100",
            name=op.f("ck_discovered_queries_difficulty_range"),
        ),
        sa.CheckConstraint(
            "estimated_search_volume >= 0",
            name=op.f("ck_discovered_queries_volume_nonnegative"),
        ),
        sa.CheckConstraint(
            "opportunity_score BETWEEN 0 AND 1",
            name=op.f("ck_discovered_queries_score_range"),
        ),
        sa.CheckConstraint(
            "visibility_position > 0",
            name=op.f("ck_discovered_queries_position_positive"),
        ),
        sa.ForeignKeyConstraint(
            ["profile_uuid"],
            ["business_profiles.uuid"],
            name=op.f("fk_discovered_queries_profile_uuid_business_profiles"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["run_uuid"],
            ["pipeline_runs.uuid"],
            name=op.f("fk_discovered_queries_run_uuid_pipeline_runs"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("uuid", name=op.f("pk_discovered_queries")),
    )
    with op.batch_alter_table("discovered_queries", schema=None) as batch_op:
        batch_op.create_index(
            "ix_queries_profile_score",
            ["profile_uuid", sa.literal_column("opportunity_score DESC")],
            unique=False,
        )
        batch_op.create_index(
            "ix_queries_profile_visible",
            ["profile_uuid", "domain_visible"],
            unique=False,
        )

    op.create_index(
        "uq_queries_profile_text_lower",
        "discovered_queries",
        ["profile_uuid", sa.text("lower(query_text)")],
        unique=True,
    )
    op.create_table(
        "content_recommendations",
        sa.Column("profile_uuid", sa.Uuid(), nullable=False),
        sa.Column("query_uuid", sa.Uuid(), nullable=False),
        sa.Column("run_uuid", sa.Uuid(), nullable=False),
        sa.Column("content_type", sa.String(length=20), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("rationale", sa.Text(), nullable=False),
        sa.Column("target_keywords", sa.JSON(), nullable=False),
        sa.Column("priority", sa.String(length=10), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("uuid", sa.Uuid(), nullable=False),
        sa.CheckConstraint(
            "content_type IN ('blog_post', 'landing_page', 'faq')",
            name=op.f("ck_content_recommendations_content_type"),
        ),
        sa.CheckConstraint(
            "priority IN ('high', 'medium', 'low')",
            name=op.f("ck_content_recommendations_priority"),
        ),
        sa.ForeignKeyConstraint(
            ["profile_uuid"],
            ["business_profiles.uuid"],
            name=op.f("fk_content_recommendations_profile_uuid_business_profiles"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["query_uuid"],
            ["discovered_queries.uuid"],
            name=op.f("fk_content_recommendations_query_uuid_discovered_queries"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["run_uuid"],
            ["pipeline_runs.uuid"],
            name=op.f("fk_content_recommendations_run_uuid_pipeline_runs"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("uuid", name=op.f("pk_content_recommendations")),
    )


def downgrade() -> None:
    op.drop_table("content_recommendations")
    op.drop_index("uq_queries_profile_text_lower", table_name="discovered_queries")
    with op.batch_alter_table("discovered_queries", schema=None) as batch_op:
        batch_op.drop_index("ix_queries_profile_visible")
        batch_op.drop_index("ix_queries_profile_score")

    op.drop_table("discovered_queries")
    with op.batch_alter_table("pipeline_runs", schema=None) as batch_op:
        batch_op.drop_index("ix_pipeline_runs_profile_created")

    op.drop_table("pipeline_runs")
    op.drop_index("uq_business_profiles_domain_lower", table_name="business_profiles")
    op.drop_table("business_profiles")
