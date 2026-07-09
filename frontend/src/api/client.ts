import axios from "axios";
import type {
  AuthResponse, ChampionAdminSummary, ChampionPick, ChampionStatus,
  DashboardStats, LeaderboardRow, Match, Payment, Prediction, PredictionStats,
  PublicSettings, StaffDashboard, Team, User, Winner,
} from "./types";

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const TOKEN_KEY = "pcwc_token";

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

/** Turn a stored /uploads path into an absolute URL against the API host. */
export function assetUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("http")) return path;
  return `${API_URL}${path}`;
}

export const api = axios.create({ baseURL: `${API_URL}/api` });

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes("/auth/login")) {
      tokenStore.clear();
      if (!location.pathname.startsWith("/login")) location.href = "/login";
    }
    return Promise.reject(error);
  },
);

/** Extract a human-readable message from an Axios error. */
export function errMsg(e: unknown, fallback = "Something went wrong"): string {
  const detail = (e as any)?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d) => d.msg).join(", ");
  return fallback;
}

// ---- Auth ----
export const authApi = {
  login: (email: string, password: string) =>
    api.post<AuthResponse>("/auth/login", { email, password }).then((r) => r.data),
  register: (form: FormData) =>
    api.post<User>("/auth/register", form).then((r) => r.data),
  me: () => api.get<User>("/auth/me").then((r) => r.data),
};

// ---- Matches / predictions ----
export const matchApi = {
  list: (params?: { status?: string; upcoming?: boolean }) =>
    api.get<Match[]>("/matches", { params }).then((r) => r.data),
  get: (id: number) => api.get<Match>(`/matches/${id}`).then((r) => r.data),
  create: (body: any) => api.post<Match>("/matches", body).then((r) => r.data),
  update: (id: number, body: any) => api.patch<Match>(`/matches/${id}`, body).then((r) => r.data),
  toggleLock: (id: number, lock: boolean) =>
    api.post(`/matches/${id}/lock`, null, { params: { lock } }).then((r) => r.data),
  remove: (id: number) => api.delete(`/matches/${id}`).then((r) => r.data),
};

export const predictionApi = {
  upsert: (body: {
    match_id: number; pred_home_score: number; pred_away_score: number;
    pred_home_penalty?: number | null; pred_away_penalty?: number | null;
  }) => api.post<Prediction>("/predictions", body).then((r) => r.data),
  mine: () => api.get<Prediction[]>("/predictions/mine").then((r) => r.data),
  forMatch: (id: number) => api.get<Prediction[]>(`/predictions/match/${id}`).then((r) => r.data),
};

// ---- Leaderboard / dashboards ----
export const leaderboardApi = {
  get: (params?: { limit?: number; search?: string }) =>
    api.get<LeaderboardRow[]>("/leaderboard", { params }).then((r) => r.data),
};

export const userApi = {
  dashboard: () => api.get<StaffDashboard>("/users/me/dashboard").then((r) => r.data),
  list: () => api.get<User[]>("/users").then((r) => r.data),
  setStatus: (id: number, status: string) =>
    api.post(`/users/${id}/status`, null, { params: { status } }).then((r) => r.data),
};

// ---- Payments ----
export const paymentApi = {
  mine: () => api.get<Payment | null>("/payments/mine").then((r) => r.data),
  list: (status?: string) =>
    api.get<Payment[]>("/payments", { params: { status } }).then((r) => r.data),
  review: (id: number, approve: boolean, note?: string) =>
    api.post(`/payments/${id}/review`, { approve, note }).then((r) => r.data),
};

// ---- Settings ----
export const settingsApi = {
  publicSettings: () => api.get<PublicSettings>("/settings/public").then((r) => r.data),
  uploadQr: (form: FormData) => api.post("/settings/qr", form).then((r) => r.data),
  uploadLogo: (form: FormData) => api.post("/settings/logo", form).then((r) => r.data),
  setText: (key: string, value: string) => {
    const f = new FormData();
    f.append("value", value);
    return api.put(`/settings/${key}`, f).then((r) => r.data);
  },
};

// ---- Stats ----
export const statsApi = {
  dashboard: () => api.get<DashboardStats>("/stats/dashboard").then((r) => r.data),
  predictions: () => api.get<PredictionStats>("/stats/predictions").then((r) => r.data),
  extremes: () => api.get("/stats/leaderboard-extremes").then((r) => r.data),
};

// ---- Winners (auto-calculated from the leaderboard) ----
export const winnerApi = {
  list: () => api.get<Winner[]>("/winners").then((r) => r.data),
  adminList: () => api.get<Winner[]>("/winners/admin").then((r) => r.data),
  reveal: () => api.post<Winner[]>("/winners/reveal").then((r) => r.data),
  hide: () => api.post("/winners/hide").then((r) => r.data),
};

// ---- Champion (World Cup winner) prediction ----
export const championApi = {
  teams: () => api.get<Team[]>("/champion/teams").then((r) => r.data),
  status: () => api.get<ChampionStatus>("/champion/status").then((r) => r.data),
  pick: (team_id: number) =>
    api.post<ChampionPick>("/champion/pick", { team_id }).then((r) => r.data),
  // admin
  adminSummary: () =>
    api.get<ChampionAdminSummary>("/champion/admin/summary").then((r) => r.data),
  updateConfig: (body: {
    is_open?: boolean; deadline?: string | null; clear_deadline?: boolean;
    bonus_points?: number; prize?: string; prize_amount?: number;
  }) => api.put<ChampionAdminSummary>("/champion/admin/config", body).then((r) => r.data),
  settle: (team_id: number) =>
    api.post<ChampionAdminSummary>("/champion/admin/settle", { team_id }).then((r) => r.data),
  reopen: () => api.post<ChampionAdminSummary>("/champion/admin/reopen").then((r) => r.data),
};

// ---- Admin ops ----
export const adminApi = {
  syncNow: () => api.post("/admin/sync-now").then((r) => r.data),
  recalculate: () => api.post("/admin/recalculate").then((r) => r.data),
  clearMatches: () => api.post("/admin/clear-matches").then((r) => r.data),
  schedulerLogs: () => api.get("/admin/scheduler-logs").then((r) => r.data),
  auditLogs: () => api.get("/admin/audit-logs").then((r) => r.data),
};
