"""Weighted prediction scoring engine.

This module implements the fair, multi-component scoring described in
docs/SCORING.md. Nothing here uses naive exact-match scoring.

Per match a prediction earns:

    total = (outcome_points + closeness_points + penalty_points) * difficulty_multiplier

Components
----------
outcome_points   (0..40)  40 if the predicted regulation result
                          (home win / draw / away win) matches the actual
                          regulation result, otherwise 0.

closeness_points (0..40)  A smooth, monotonic reward for how close the
                          predicted scoreline is to the actual scoreline.
                          It blends absolute scoreline error (exponential
                          decay) with a goal-difference match term, so a
                          prediction that gets the margin right is rewarded
                          even if the exact goals differ.

penalty_points   (0..20)  Only for matches decided by a shootout. 20 for an
                          exact shootout score, 15 for the correct shootout
                          winner (or within one goal on both sides), else 0.
                          Regulation-only matches are scored out of 80.

difficulty_multiplier (>=1) "Popularity bonus". If few players predicted the
                          correct outcome, the ones who did are rewarded more.
                          multiplier = 1 + ALPHA * (1 - consensus) where
                          consensus is the fraction of players who predicted
                          the correct outcome. Only applied to players who got
                          the outcome right (an underdog reward, never a
                          penalty). Capped at 1 + ALPHA.

The theoretical maximum is 100 (a penalty match with consensus -> 0). A
regulation match maxes at 80 * (1 + ALPHA).
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Iterable, Optional

# --- Tunable weights (kept here + documented; could move to settings) ------
OUTCOME_MAX = 40.0
CLOSENESS_MAX = 40.0
PENALTY_MAX = 20.0
CLOSENESS_TAU = 1.8        # decay constant for scoreline error
GOAL_DIFF_TAU = 2.0        # decay constant for goal-difference error
CLOSENESS_SCORE_WEIGHT = 0.9
CLOSENESS_GD_WEIGHT = 0.1
POPULARITY_ALPHA = 0.5     # max +50% underdog bonus


def _outcome(home: int, away: int) -> int:
    """Return +1 home win, 0 draw, -1 away win."""
    return (home > away) - (home < away)


@dataclass
class ScoreBreakdown:
    outcome_points: float
    closeness_points: float
    penalty_points: float
    difficulty_multiplier: float
    total: float


def outcome_points(pred_h: int, pred_a: int, act_h: int, act_a: int) -> float:
    """40 if predicted regulation outcome matches actual, else 0."""
    return OUTCOME_MAX if _outcome(pred_h, pred_a) == _outcome(act_h, act_a) else 0.0


def closeness_points(pred_h: int, pred_a: int, act_h: int, act_a: int) -> float:
    """Smooth reward (0..CLOSENESS_MAX) for a close scoreline.

    Formula:  closeness = 40 * (0.9 * e^(-scoreError/1.8) + 0.1 * goalDiffFactor)
    where scoreError = |pred_h-act_h| + |pred_a-act_a| and goalDiffFactor is 1.0
    when the predicted goal difference is exact, decaying otherwise.
    """
    score_err = abs(pred_h - act_h) + abs(pred_a - act_a)
    score_factor = math.exp(-score_err / CLOSENESS_TAU)  # 1.0 at exact

    gd_err = abs((pred_h - pred_a) - (act_h - act_a))
    gd_factor = 1.0 if gd_err == 0 else math.exp(-gd_err / GOAL_DIFF_TAU)

    blended = CLOSENESS_SCORE_WEIGHT * score_factor + CLOSENESS_GD_WEIGHT * gd_factor
    return round(CLOSENESS_MAX * blended, 2)


def penalty_points(
    pred_hp: Optional[int],
    pred_ap: Optional[int],
    act_hp: Optional[int],
    act_ap: Optional[int],
) -> float:
    """Shootout scoring (0..PENALTY_MAX). Returns 0 if no shootout occurred."""
    if act_hp is None or act_ap is None:
        return 0.0
    if pred_hp is None or pred_ap is None:
        return 0.0
    if pred_hp == act_hp and pred_ap == act_ap:
        return PENALTY_MAX
    # correct shootout winner, or within one goal on both sides -> partial
    correct_winner = _outcome(pred_hp, pred_ap) == _outcome(act_hp, act_ap)
    close = abs(pred_hp - act_hp) <= 1 and abs(pred_ap - act_ap) <= 1
    if correct_winner or close:
        return 15.0
    return 0.0


def difficulty_multiplier(consensus_fraction: float, outcome_correct: bool) -> float:
    """Popularity/underdog multiplier applied only to correct-outcome players."""
    if not outcome_correct:
        return 1.0
    consensus = max(0.0, min(1.0, consensus_fraction))
    return round(1.0 + POPULARITY_ALPHA * (1.0 - consensus), 4)


def score_prediction(
    pred_h: int,
    pred_a: int,
    act_h: int,
    act_a: int,
    pred_hp: Optional[int] = None,
    pred_ap: Optional[int] = None,
    act_hp: Optional[int] = None,
    act_ap: Optional[int] = None,
    consensus_fraction: float = 1.0,
) -> ScoreBreakdown:
    """Compute the full breakdown for one prediction against a final result.

    ``consensus_fraction`` is the share of all players who predicted the
    correct outcome for this match (used for the popularity bonus).
    """
    op = outcome_points(pred_h, pred_a, act_h, act_a)
    cp = closeness_points(pred_h, pred_a, act_h, act_a)
    pp = penalty_points(pred_hp, pred_ap, act_hp, act_ap)
    outcome_correct = op > 0
    mult = difficulty_multiplier(consensus_fraction, outcome_correct)
    total = round((op + cp + pp) * mult, 2)
    return ScoreBreakdown(op, cp, pp, mult, total)


def compute_consensus(
    predictions: Iterable[tuple[int, int]], act_h: int, act_a: int
) -> float:
    """Fraction of predictions whose outcome matches the actual outcome.

    ``predictions`` is an iterable of (pred_home, pred_away) tuples.
    Returns 1.0 when there are no predictions (no bonus).
    """
    actual = _outcome(act_h, act_a)
    total = 0
    correct = 0
    for ph, pa in predictions:
        total += 1
        if _outcome(ph, pa) == actual:
            correct += 1
    if total == 0:
        return 1.0
    return correct / total
