"""add champion_predictions

Revision ID: a1c2h3a4m5p6
Revises: 087080affc76
Create Date: 2026-07-09 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1c2h3a4m5p6'
down_revision: Union[str, None] = '087080affc76'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'champion_predictions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('team_id', sa.Integer(), nullable=False),
        sa.Column('is_correct', sa.Boolean(), nullable=False),
        sa.Column('points_awarded', sa.Float(), nullable=False),
        sa.Column('is_settled', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True),
                  server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['team_id'], ['teams.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', name='uq_champion_user'),
    )
    with op.batch_alter_table('champion_predictions', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_champion_predictions_team_id'), ['team_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_champion_predictions_user_id'), ['user_id'], unique=True)


def downgrade() -> None:
    with op.batch_alter_table('champion_predictions', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_champion_predictions_user_id'))
        batch_op.drop_index(batch_op.f('ix_champion_predictions_team_id'))
    op.drop_table('champion_predictions')
