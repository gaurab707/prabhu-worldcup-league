import { Box, Grid, Stack, Typography, Chip, Button, useTheme, LinearProgress, alpha } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import {
  Area, AreaChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis,
} from "recharts";
import { Link as RouterLink } from "react-router-dom";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import MilitaryTechIcon from "@mui/icons-material/MilitaryTech";
import PercentIcon from "@mui/icons-material/Percent";
import EventIcon from "@mui/icons-material/Event";
import PublicIcon from "@mui/icons-material/Public";
import LockIcon from "@mui/icons-material/Lock";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import dayjs from "dayjs";
import { userApi, matchApi, leaderboardApi, championApi } from "../api/client";
import { GlassCard, StatCard, PageHeader, CardSkeleton, TeamFlag } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { BRAND } from "../theme/theme";

/** Compact champion-pick prompt / status shown on the dashboard. */
function ChampionBanner() {
  const theme = useTheme();
  const { data: st } = useQuery({ queryKey: ["champion-status"], queryFn: championApi.status });
  if (!st) return null;

  // Settled — show the result.
  if (st.is_settled && st.my_pick) {
    const ok = st.my_pick.is_correct;
    return (
      <GlassCard sx={{ mb: 2.5, borderLeft: `6px solid ${ok ? BRAND.pitch : BRAND.danger}` }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={1.5} alignItems="center">
            {ok ? <CheckCircleIcon sx={{ color: BRAND.pitch }} /> : <CancelIcon sx={{ color: BRAND.danger }} />}
            <Typography>
              World Cup champion pick: <b>{st.my_pick.team.name}</b> — {ok ? "correct!" : "not this time"}
            </Typography>
          </Stack>
          {ok && <Chip color="success" label={`+${st.my_pick.points_awarded} pts`} sx={{ fontWeight: 800 }} />}
        </Stack>
      </GlassCard>
    );
  }

  // Has a pick, awaiting settlement.
  if (st.my_pick) {
    return (
      <GlassCard sx={{ mb: 2.5 }}>
        <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={1.5} alignItems="center">
            <TeamFlag team={st.my_pick.team} size={30} />
            <Typography>Your World Cup champion pick: <b>{st.my_pick.team.name}</b></Typography>
            <Chip size="small" icon={<LockIcon sx={{ fontSize: 14 }} />} label="Locked" color="warning" />
          </Stack>
          <Button component={RouterLink} to="/champion" size="small">View</Button>
        </Stack>
      </GlassCard>
    );
  }

  // No pick yet, window open — nudge to pick.
  if (st.is_open) {
    return (
      <Box sx={{ mb: 2.5, p: 2.5, borderRadius: 4,
        background: `linear-gradient(135deg, ${alpha(BRAND.amber, 0.18)}, ${alpha(BRAND.azure, 0.12)})`,
        border: `1px solid ${theme.palette.divider}` }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="center" justifyContent="space-between">
          <Stack direction="row" spacing={1.5} alignItems="center">
            <PublicIcon color="secondary" />
            <Box>
              <Typography fontWeight={700}>Predict the World Cup champion 🏆</Typography>
              <Typography variant="body2" color="text.secondary">
                One pick, locked forever. Win <b>{st.bonus_points} bonus points</b>{st.prize_amount ? ` + Rs. ${st.prize_amount}` : ""} if you&rsquo;re right.
                {st.deadline && <> Closes {dayjs(st.deadline).format("MMM D, HH:mm")}.</>}
              </Typography>
            </Box>
          </Stack>
          <Button component={RouterLink} to="/champion" variant="contained" startIcon={<PublicIcon />}>
            Pick now
          </Button>
        </Stack>
      </Box>
    );
  }
  return null;
}

export default function Dashboard() {
  const theme = useTheme();
  const { user } = useAuth();
  const { data: dash, isLoading } = useQuery({ queryKey: ["staff-dashboard"], queryFn: userApi.dashboard });
  const { data: upcoming } = useQuery({ queryKey: ["matches", "upcoming"], queryFn: () => matchApi.list({ upcoming: true }) });
  const { data: board } = useQuery({ queryKey: ["leaderboard", "top5"], queryFn: () => leaderboardApi.get({ limit: 5 }) });

  const chartData = (dash?.points_over_time || []).map((p) => ({
    date: dayjs(p.date).format("MMM D"), points: p.points,
  }));

  return (
    <Box>
      <PageHeader
        title={`Hi ${user?.full_name?.split(" ")[0] || ""} 👋`}
        subtitle="Here's how your World Cup campaign is going."
      />

      <ChampionBanner />

      {isLoading ? (
        <Grid container spacing={2.5}>{[0, 1, 2, 3].map((i) => <Grid item xs={12} sm={6} md={3} key={i}><CardSkeleton /></Grid>)}</Grid>
      ) : (
        <Grid container spacing={2.5}>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard icon={<EmojiEventsIcon />} accent={BRAND.amber} label="Total points"
                      value={dash?.total_points ?? 0} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard icon={<MilitaryTechIcon />} accent={BRAND.azure} label="Leaderboard rank"
                      value={dash?.rank ? `#${dash.rank}` : "—"} sub={`of ${dash?.total_players ?? 0} players`} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard icon={<PercentIcon />} accent={BRAND.pitch} label="Winner accuracy"
                      value={`${dash?.accuracy ?? 0}%`} sub={`${dash?.played ?? 0} matches scored`} />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard icon={<EventIcon />} accent="#A78BFA" label="Open to predict"
                      value={dash?.upcoming_games ?? 0} sub="upcoming games" />
          </Grid>
        </Grid>
      )}

      <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
        <Grid item xs={12} md={8}>
          <GlassCard sx={{ height: 340 }}>
            <Typography variant="h6" gutterBottom>Points over time</Typography>
            {chartData.length === 0 ? (
              <Box sx={{ height: 260, display: "grid", placeItems: "center", color: "text.secondary" }}>
                No scored matches yet — your points will appear here.
              </Box>
            ) : (
              <ResponsiveContainer width="100%" height={270}>
                <AreaChart data={chartData} margin={{ left: -20, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={BRAND.azure} stopOpacity={0.5} />
                      <stop offset="100%" stopColor={BRAND.azure} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" stroke={theme.palette.text.secondary} fontSize={12} />
                  <YAxis stroke={theme.palette.text.secondary} fontSize={12} />
                  <RTooltip contentStyle={{ background: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 12 }} />
                  <Area type="monotone" dataKey="points" stroke={BRAND.azure} strokeWidth={2.5} fill="url(#g)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </GlassCard>
        </Grid>

        <Grid item xs={12} md={4}>
          <GlassCard sx={{ height: 340, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <Typography variant="h6" gutterBottom>Top of the table</Typography>
            <Stack spacing={1.25} sx={{ overflowY: "auto" }}>
              {(board || []).map((r) => (
                <Stack key={r.user_id} direction="row" alignItems="center" spacing={1.5}
                       sx={{ p: 1, borderRadius: 2, background: r.user_id === user?.id ? `${BRAND.azure}1f` : "transparent" }}>
                  <Typography sx={{ width: 24, fontWeight: 800, color: r.rank <= 3 ? BRAND.amber : "text.secondary" }}>
                    {r.rank}
                  </Typography>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography noWrap fontWeight={600}>{r.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{r.department || "—"}</Typography>
                  </Box>
                  <Chip size="small" label={`${r.points} pt`} />
                </Stack>
              ))}
              {!board?.length && <Typography color="text.secondary" variant="body2">No players yet.</Typography>}
            </Stack>
          </GlassCard>
        </Grid>

        <Grid item xs={12}>
          <GlassCard>
            <Typography variant="h6" gutterBottom>Next up</Typography>
            <Grid container spacing={2}>
              {(upcoming || []).slice(0, 4).map((m) => (
                <Grid item xs={12} sm={6} md={3} key={m.id}>
                  <Box sx={{ p: 1.75, borderRadius: 3, border: `1px solid ${theme.palette.divider}` }}>
                    <Typography variant="caption" color="text.secondary">{m.round_name}</Typography>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ my: 1 }}>
                      <Stack alignItems="center" spacing={0.5} sx={{ flex: 1 }}>
                        <TeamFlag team={m.home_team} /><Typography variant="caption" noWrap>{m.home_team.short_code}</Typography>
                      </Stack>
                      <Typography variant="caption" color="text.secondary">vs</Typography>
                      <Stack alignItems="center" spacing={0.5} sx={{ flex: 1 }}>
                        <TeamFlag team={m.away_team} /><Typography variant="caption" noWrap>{m.away_team.short_code}</Typography>
                      </Stack>
                    </Stack>
                    <Typography variant="caption" color="text.secondary" display="block" textAlign="center">
                      {dayjs(m.kickoff_at).format("MMM D · HH:mm")}
                    </Typography>
                    {m.my_prediction ? (
                      <Chip size="small" color="success" sx={{ mt: 1, width: "100%" }}
                            label={`Your call: ${m.my_prediction.pred_home_score}-${m.my_prediction.pred_away_score}`} />
                    ) : (
                      <Chip size="small" variant="outlined" color="warning" sx={{ mt: 1, width: "100%" }} label="Not predicted" />
                    )}
                  </Box>
                </Grid>
              ))}
              {!upcoming?.length && <Grid item xs={12}><Typography color="text.secondary">No upcoming games scheduled.</Typography></Grid>}
            </Grid>
          </GlassCard>
        </Grid>
      </Grid>
    </Box>
  );
}
