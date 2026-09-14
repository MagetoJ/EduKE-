"""add school_id to refresh tokens

Revision ID: b26766be4570
Revises: 
Create Date: 2026-09-13 09:10:51.251956

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b26766be4570'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add school_id to refresh_tokens."""
    op.add_column(
        "refresh_tokens",
        sa.Column("school_id", sa.Integer(), nullable=True),
    )

    op.create_index(
        "ix_refresh_tokens_school_id",
        "refresh_tokens",
        ["school_id"],
        unique=False,
    )

    op.create_foreign_key(
        "fk_refresh_tokens_school_id_schools",
        "refresh_tokens",
        "schools",
        ["school_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    """Remove school_id from refresh_tokens."""
    op.drop_constraint(
        "fk_refresh_tokens_school_id_schools",
        "refresh_tokens",
        type_="foreignkey",
    )

    op.drop_index(
        "ix_refresh_tokens_school_id",
        table_name="refresh_tokens",
    )

    op.drop_column(
        "refresh_tokens",
        "school_id",
    )
