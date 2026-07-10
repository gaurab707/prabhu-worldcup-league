# 🎯 The Scoring System

This is the heart of the league. Most office prediction games use *exact-match* scoring:
you get points only if you nail the precise scoreline, and nothing otherwise. That's
unsatisfying — predicting 2–1 when the game ends 3–1 feels like it should count for
*something*, and it does here.

Every prediction is scored on **four components** that combine into one total:

```
total = (outcome_points + closeness_points + penalty_points) × difficulty_multiplier
```

All the tunable constants live at the top of
[`backend/app/services/scoring.py`](../backend/app/services/scoring.py) — change them in
one place and every match rescoring picks up the new values.

---

## 1. Outcome points — up to **40**

Did you call the **result** correctly: home win, draw, or away win (in regulation)?

- Correct outcome → **40 points**
- Wrong outcome → **0 points**

This is the single biggest lever: getting the winner right matters most.

---

## 2. Closeness points — up to **40**

A **smooth, monotonic** reward for how near your predicted scoreline was to reality. It
blends two ideas:

```
closeness = 40 × ( 0.7 × exp(−scoreError / 1.5)  +  0.3 × goalDiffFactor )
```

where

- `scoreError` = |your home − actual home| + |your away − actual away|
- `goalDiffFactor` = 1 if you got the **goal margin** exactly right, otherwise
  `exp(−marginError / 2.0)`

What this means in practice:

- An **exact** scoreline → the full 40.
- **Right margin, wrong goals** (you said 2–1, it finished 3–2) → still a healthy chunk,
  because the margin term rewards you.
- **Way off** (you said 0–0, it finished 4–1) → close to 0.

Crucially, closeness is earned **even when you got the outcome wrong** — so a narrowly
incorrect call still scores a little, which keeps everyone in the game.

---

## 3. Penalty points — up to **20** (knockout shootouts only)

For matches decided by a **penalty shootout**:

- Exact shootout score (e.g. you said 4–2, it was 4–2) → **20**
- Correct shootout winner, or within one goal on both sides → **15**
- Otherwise → **0**

Regulation matches (no shootout) are simply scored out of **80** — they never lose out for
not having this component.

---

## 4. Difficulty multiplier — the **popularity bonus** (×1 and up)

This is what makes the league feel fair and exciting. If you correctly back an **underdog**
that almost nobody else did, you deserve more than someone who took the obvious favourite.

```
multiplier = 1 + 0.5 × (1 − consensus)
```

where `consensus` is the **fraction of all players who predicted the correct outcome** for
that match.

- Everyone got it right (`consensus = 1`) → ×1.0 (no bonus, it was obvious).
- Only 20% got it right (`consensus = 0.2`) → ×1.4.
- A lone correct voice (`consensus → 0`) → up to ×1.5.

Two deliberate design choices:

1. The bonus is applied **only to players who got the outcome right** — it's a reward for
   bravery, never a penalty for the crowd.
2. Because it multiplies the base score, a gutsy correct underdog call can push a single
   match **above 100 points**. That's intentional: the "max 100" is the *base* ceiling, and
   the popularity bonus is an explicit uplift on top of it.

---

## Worked examples

Assume the match finished **2–1** (a home win).

| Your prediction | Outcome | Closeness | Penalty | Consensus | Multiplier | **Total** |
|-----------------|--------:|----------:|--------:|----------:|-----------:|----------:|
| 2–1 (exact)     | 40      | 40        | –       | 60%       | ×1.20      | **96.0**  |
| 3–1 (right winner, wrong margin) | 40 | ~23 | – | 60% | ×1.20 | **~76** |
| 1–1 (wrong: draw) | 0     | ~23       | –       | 60%       | ×1.00*     | **~23**   |
| 2–1 (exact), but an underdog call | 40 | 40 | – | 15% | ×1.43 | **~114** |

\* Wrong-outcome predictions never receive the popularity bonus.

For a **shootout** that finished 1–1 (4–2 pens) and you predicted exactly that with full
consensus: `40 + 40 + 20 = 100` → the theoretical maximum.

---

## How and when scoring runs

- When an admin **enters a final result** (or the scraper ingests one), the match is marked
  finished and **rescored automatically**.
- Scoring is **idempotent** — a match is only scored once unless an admin explicitly
  **Recalculates** (Admin → Overview → *Recalculate*), which is safe to run any time, e.g.
  after correcting a scoreline.
- Each player's **total points** and the **leaderboard** are recomputed from the per-match
  breakdown, so everything always reconciles.

Every prediction stores its full breakdown (outcome / closeness / penalty / multiplier), so
players can see *exactly* how each score was earned on the Predictions → Completed tab.
