"""create ocr_results table

Revision ID: 79d9ec33daf3
Revises: b01d6f50a3e0
Create Date: 2026-03-12 11:21:06.412009

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '79d9ec33daf3'
down_revision: Union[str, Sequence[str], None] = 'b01d6f50a3e0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('ocr_results',
        sa.Column('id', sa.UUID(as_uuid=True), nullable=False),
        sa.Column('file_id', sa.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', sa.UUID(as_uuid=True), nullable=False),
        sa.Column('extracted_text', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['file_id'], ['files.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('file_id')
    )
    op.create_index(op.f('ix_ocr_results_id'), 'ocr_results', ['id'], unique=False)
    op.create_index(op.f('ix_ocr_results_file_id'), 'ocr_results', ['file_id'], unique=True)
    op.create_index(op.f('ix_ocr_results_user_id'), 'ocr_results', ['user_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_ocr_results_user_id'), table_name='ocr_results')
    op.drop_index(op.f('ix_ocr_results_file_id'), table_name='ocr_results')
    op.drop_index(op.f('ix_ocr_results_id'), table_name='ocr_results')
    op.drop_table('ocr_results')
