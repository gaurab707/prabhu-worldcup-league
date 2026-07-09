"""Unit tests for the weighted scoring engine.

Run:  pytest -q   (from the backend/ directory, with the venv active)
"""
import math

from app.services.scoring import (
    OUTCOME_MAX,
    POPULARITY_ALPHA,
    closeness_points,
    compute_consensus,
    difficulty_multiplier,
    outcome_points,
    penalty_points,
    score_prediction,
)


def test_exact_prediction_is_max_outcome_and_closeness():
    assert outcome_points(2, 1, 2, 1) == OUTCOME_MAX
    assert closeness_points(2, 1, 2, 1) == 40.0  # exact -> full


def test_wrong_outcome_gives_zero_outcome_points():
    # predicted draw, actual home win
    assert outcome_points(1, 1, 2, 1) == 0.0
    # but closeness still gives partial credit
    assert 0 < closeness_points(1, 1, 2, 1) < 40


def test_closeness_is_monotonic_in_error():
    actual = (2, 1)
    near = closeness_points(2, 0, *actual)   # 1 goal off
    far = closeness_points(0, 4, *actual)    # far off
    assert near > far


def test_penalty_scoring():
    assert penalty_points(5, 4, 5, 4) == 20.0          # exact shootout
    assert penalty_points(5, 3, 5, 4) == 15.0          # within one / correct winner
    assert penalty_points(2, 4, 5, 4) == 0.0           # wrong shootout winner, not close
    assert penalty_points(None, None, 5, 4) == 0.0     # no prediction
    assert penalty_points(5, 4, None, None) == 0.0     # no shootout


def test_popularity_bonus_rewards_underdog():
    rare = difficulty_multiplier(0.2, outcome_correct=True)   # few got it right
    common = difficulty_multiplier(0.8, outcome_correct=True)  # many got it right
    assert rare > common
    assert math.isclose(rare, 1 + POPULARITY_ALPHA * 0.8, rel_tol=1e-6)
    # wrong-outcome players get no bonus
    assert difficulty_multiplier(0.2, outcome_correct=False) == 1.0


def test_full_score_breakdown_penalty_match():
    b = score_prediction(
        1, 1, 1, 1,
        pred_hp=5, pred_ap=4, act_hp=5, act_ap=4,
        consensus_fraction=1.0,
    )
    assert b.outcome_points == 40
    assert b.closeness_points == 40
    assert b.penalty_points == 20
    assert b.total == 100  # theoretical max at full consensus


def test_consensus_fraction():
    preds = [(2, 1), (1, 0), (0, 0), (1, 2)]  # actual 2-1 => home win
    # home wins: (2,1) and (1,0) => 2/4 = 0.5
    assert compute_consensus(preds, 2, 1) == 0.5
    assert compute_consensus([], 2, 1) == 1.0  # no bonus when nobody predicted
