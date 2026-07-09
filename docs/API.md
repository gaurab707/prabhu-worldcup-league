# 🔌 API Reference

Base URL: `http://<host>:8000/api`
Interactive docs (Swagger): `http://<host>:8000/docs` · ReDoc: `/redoc`

Authentication is via **JWT bearer token**. Log in, then send
`Authorization: Bearer <token>` on protected requests. Tokens are valid for 7 days.

Roles: **staff** (default) and **admin**. Endpoints marked 🔒 require admin.

---

## Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Register (multipart form: email, full_name, password, confirm_password, department?, payment_screenshot?). Creates a **pending** user + pending payment. |
| POST | `/auth/login` | Body `{email, password}` → `{access_token, user}`. Blocks pending/rejected users. |
| GET  | `/auth/me` | Current user profile. |

## Matches
| Method | Path | Description |
|--------|------|-------------|
| GET    | `/matches` | List matches. Query: `status`, `upcoming=true`. Each includes `is_locked` and the caller's `my_prediction`. |
| GET    | `/matches/{id}` | Single match. |
| POST   | `/matches` 🔒 | Create a fixture (teams auto-created by name). |
| PATCH  | `/matches/{id}` 🔒 | Update fixture / enter result. Setting a final score + `status=finished` triggers rescoring. |
| POST   | `/matches/{id}/lock?lock=true` 🔒 | Manually lock/unlock predictions. |
| DELETE | `/matches/{id}` 🔒 | Delete a fixture. |

## Predictions
| Method | Path | Description |
|--------|------|-------------|
| POST | `/predictions` | Create or update your prediction `{match_id, pred_home_score, pred_away_score, pred_home_penalty?, pred_away_penalty?}`. Rejected once the match is locked. |
| GET  | `/predictions/mine` | All your predictions. |
| GET  | `/predictions/match/{id}` | Predictions for a match (own only, unless the match is finished **and** predictions have been revealed). |

## Leaderboard & dashboards
| Method | Path | Description |
|--------|------|-------------|
| GET | `/leaderboard` | Ranked players. Query: `limit`, `search`. Includes points, played, accuracy breakdown. |
| GET | `/users/me/dashboard` | Personal stats: points, rank, accuracy, points-over-time series. |

## Payments
| Method | Path | Description |
|--------|------|-------------|
| GET  | `/payments/mine` | Your own payment record. |
| GET  | `/payments` 🔒 | List payments. Query: `status` (pending/verified/rejected). |
| POST | `/payments/{id}/review` 🔒 | Body `{approve, note?}`. Approving **activates** the user. |

## Users
| Method | Path | Description |
|--------|------|-------------|
| GET  | `/users` 🔒 | All users with payment status + points. |
| POST | `/users/{id}/status?status=active` 🔒 | Set a user's account status (active/pending/disabled/rejected). |

## Settings (branding & payment)
| Method | Path | Description |
|--------|------|-------------|
| GET  | `/settings/public` | Logo URL, payment QR URL, payment message, winner banner text. |
| POST | `/settings/qr` 🔒 | Upload payment QR image (multipart `file`). |
| POST | `/settings/logo` 🔒 | Upload company logo (multipart `file`). |
| PUT  | `/settings/{key}` 🔒 | Set a text setting (multipart `value`), e.g. `payment_message`, `winner_banner_text`. |

## Stats (admin analytics)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/stats/dashboard` 🔒 | Headline counts + prize pool. |
| GET | `/stats/predictions` 🔒 | Most/least predicted teams, common scorelines. |
| GET | `/stats/leaderboard-extremes` 🔒 | Top/bottom performers. |

## Winners (auto-calculated)
| Method | Path | Description |
|--------|------|-------------|
| GET  | `/winners` | Published podium (visible to logged-in users); empty until revealed. |
| GET  | `/winners/admin` 🔒 | All podium rows regardless of published state. |
| POST | `/winners/reveal` 🔒 | Capture the current **top 3 from the leaderboard** and publish them. Returns the podium. |
| POST | `/winners/hide` 🔒 | Unpublish (hide) the podium. |

## Champion (World Cup winner prediction) 🏆
A **one-time, non-editable** pick for the tournament champion, with a bonus-point
prize for correct guesses. There is deliberately **no update/delete route** for a
player's pick — once made it is permanent.

| Method | Path | Description |
|--------|------|-------------|
| GET  | `/champion/teams` | Countries a player may pick from (alphabetical, with flags). |
| GET  | `/champion/status` | Player view: `{is_open, deadline, is_settled, bonus_points, prize, prize_amount, entry_fee, total_picks, my_pick, actual_team}`. |
| POST | `/champion/pick` | Lock in your pick `{team_id}`. **One-time** — returns 409 if you already picked, 403 if picking is closed/settled. |
| GET  | `/champion/admin/summary` 🔒 | Config + settlement state + per-country pick tally. |
| PUT  | `/champion/admin/config` 🔒 | Configure the window/prize `{is_open?, deadline?, clear_deadline?, bonus_points?, prize?, prize_amount?}`. |
| POST | `/champion/admin/settle` 🔒 | Declare the champion `{team_id}`; awards the bonus to correct picks and folds it into the leaderboard. |
| POST | `/champion/admin/reopen` 🔒 | Undo a settlement: clears bonuses, keeps picks, re-opens picking. |

## Admin operations
| Method | Path | Description |
|--------|------|-------------|
| POST | `/admin/sync-now` 🔒 | Trigger a fixture/result sync immediately. |
| POST | `/admin/recalculate` 🔒 | Re-score all finished matches and rebuild totals. |
| GET  | `/admin/scheduler-logs` 🔒 | Recent scheduler runs. |
| GET  | `/admin/audit-logs` 🔒 | Recent admin actions. |

## Health
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness probe → `{status: "healthy"}`. |

---

### Rate limiting
All endpoints are IP-rate-limited (default 300 requests/minute) via `slowapi`. Adjust in
`backend/app/main.py`.

### Errors
Errors return `{"detail": "..."}` with an appropriate HTTP status (401 unauthenticated,
403 not permitted / locked, 404 not found, 422 validation).
