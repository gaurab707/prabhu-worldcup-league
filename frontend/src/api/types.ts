// Types mirroring the FastAPI response models.

export type Role = "admin" | "staff";
export type UserStatus = "pending" | "active" | "rejected" | "disabled";
export type MatchStatus = "scheduled" | "live" | "finished" | "postponed" | "cancelled";
export type PaymentStatus = "pending" | "verified" | "rejected";

export interface User {
  id: number;
  email: string;
  full_name: string;
  department?: string | null;
  role: Role;
  status: UserStatus;
  total_points: number;
  created_at: string;
  payment_status?: PaymentStatus | null;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Team {
  id: number;
  name: string;
  short_code?: string | null;
  flag_url?: string | null;
  group_name?: string | null;
}

export interface Prediction {
  id: number;
  match_id: number;
  pred_home_score: number;
  pred_away_score: number;
  pred_home_penalty?: number | null;
  pred_away_penalty?: number | null;
  outcome_points: number;
  closeness_points: number;
  penalty_points: number;
  difficulty_multiplier: number;
  points_awarded: number;
  is_scored: boolean;
}

export interface Match {
  id: number;
  home_team: Team;
  away_team: Team;
  kickoff_at: string;
  venue?: string | null;
  group_name?: string | null;
  round_name?: string | null;
  status: MatchStatus;
  home_score?: number | null;
  away_score?: number | null;
  is_penalty: boolean;
  home_penalty?: number | null;
  away_penalty?: number | null;
  predictions_revealed: boolean;
  manually_locked: boolean;
  is_locked: boolean;
  my_prediction?: Prediction | null;
}

export interface LeaderboardRow {
  rank: number;
  user_id: number;
  name: string;
  department?: string | null;
  points: number;
  played: number;
  accuracy: number;
  winner_pct: number;
  score_pct: number;
  penalty_pct: number;
}

export interface DashboardStats {
  total_users: number;
  verified_users: number;
  pending_payments: number;
  upcoming_games: number;
  completed_games: number;
  total_predictions: number;
  prize_pool: number;
}

export interface StaffDashboard {
  total_points: number;
  rank: number | null;
  total_players: number;
  played: number;
  accuracy: number;
  winner_pct: number;
  score_pct: number;
  upcoming_games: number;
  completed_predictions: number;
  points_over_time: { date: string; points: number }[];
}

export interface Payment {
  id: number;
  user_id: number;
  amount: number;
  status: PaymentStatus;
  remarks?: string | null;
  screenshot_path?: string | null;
  created_at: string;
}

export interface PublicSettings {
  company_logo_url: string;
  payment_qr_url: string | null;
  payment_message: string;
  winner_banner_text: string;
}

export interface Winner {
  id: number;
  position: number;
  user_id: number;
  name: string;
  prize?: string | null;
  prize_amount?: number | null;
  notes?: string | null;
  points: number;
  published: boolean;
}

export interface BreakdownMatch {
  match_id: number;
  home_team: string;
  away_team: string;
  home_flag?: string | null;
  away_flag?: string | null;
  kickoff_at: string;
  actual_home?: number | null;
  actual_away?: number | null;
  is_penalty: boolean;
  actual_home_pen?: number | null;
  actual_away_pen?: number | null;
  pred_home: number;
  pred_away: number;
  pred_home_pen?: number | null;
  pred_away_pen?: number | null;
  outcome_points: number;
  closeness_points: number;
  penalty_points: number;
  difficulty_multiplier: number;
  points_awarded: number;
}

export interface ChampionContribution {
  team_name: string;
  team_flag?: string | null;
  is_correct: boolean;
  points_awarded: number;
}

export interface PointsBreakdown {
  user_id: number;
  name: string;
  department?: string | null;
  total_points: number;
  match_points: number;
  champion_points: number;
  matches: BreakdownMatch[];
  champion?: ChampionContribution | null;
}

export interface PredictionStats {
  total_predictions: number;
  most_predicted_teams: { name: string; count: number }[];
  least_predicted_teams: { name: string; count: number }[];
  most_predicted_scores: { score: string; count: number }[];
}

// ---- Champion (World Cup winner) prediction ----
export interface ChampionPick {
  id: number;
  team_id: number;
  team: Team;
  is_correct: boolean;
  points_awarded: number;
  is_settled: boolean;
  created_at: string;
}

export interface ChampionStatus {
  is_open: boolean;
  deadline?: string | null;
  is_settled: boolean;
  bonus_points: number;
  prize?: string | null;
  prize_amount?: number | null;
  entry_fee: number;
  total_picks: number;
  my_pick?: ChampionPick | null;
  actual_team?: Team | null;
}

export interface ChampionTeamTally {
  team_id: number;
  name: string;
  short_code?: string | null;
  flag_url?: string | null;
  count: number;
}

export interface ChampionAdminSummary {
  is_open: boolean;
  deadline?: string | null;
  is_settled: boolean;
  bonus_points: number;
  prize?: string | null;
  prize_amount?: number | null;
  total_picks: number;
  actual_team_id?: number | null;
  actual_team?: Team | null;
  tally: ChampionTeamTally[];
}
