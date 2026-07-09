import {
  Box, Button, Chip, Grid, Stack, Typography, useTheme,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import {
  Bar, BarChart, Cell, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis,
} from "recharts";
import SyncIcon from "@mui/icons-material/Sync";
import CalculateIcon from "@mui/icons-material/Calculate";
import GroupIcon from "@mui/icons-material/Group";
import VerifiedIcon from "@mui/icons-material/VerifiedUser";
import HourglassIcon from "@mui/icons-material/HourglassTop";
import EventIcon from "@mui/icons-material/Event";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import InsightsIcon from "@mui/icons-material/Insights";
import PaidIcon from "@mui/icons-material/Payments";
import { statsApi, adminApi } from "../../api/client";
import { GlassCard, StatCard, PageHeader, CardSkeleton } from "../../components/ui";
import { BRAND } from "../../theme/theme";

const PALETTE = [BRAND.azure, BRAND.amber, BRAND.pitch, "#A78BFA", "#F472B6", "#38BDF8", "#FB923C", "#34D399"];

export default function AdminDashboard() {
  const theme = useTheme();
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const { data: stats, isLoading } = useQuery({ queryKey: ["admin-stats"], queryFn: statsApi.dashboard });
  const { data: pstats } = useQuery({ queryKey: ["admin-pred-stats"], queryFn: statsApi.predictions });
  const { data: logs } = useQuery({ queryKey: ["scheduler-logs"], queryFn: adminApi.schedulerLogs });

  const sync = useMutation({
    mutationFn: adminApi.syncNow,
    onSuccess: (d) => { enqueueSnackbar(`Sync complete · ${d.matches_changed ?? 0} matches updated`, { variant: "success" }); qc.invalidateQueries(); },
    onError: () => enqueueSnackbar("Sync failed — check the backend logs", { variant: "error" }),
  });
  const recalc = useMutation({
    mutationFn: adminApi.recalculate,
    onSuccess: (d) => { enqueueSnackbar(`Recalculated ${d.matches} matches`, { variant: "success" }); qc.invalidateQueries(); },
  });

  const cards = [
    { icon: <GroupIcon />, label: "Total users", value: stats?.total_users ?? 0, accent: BRAND.azure },
    { icon: <VerifiedIcon />, label: "Verified", value: stats?.verified_users ?? 0, accent: BRAND.pitch },
    { icon: <HourglassIcon />, label: "Pending payments", value: stats?.pending_payments ?? 0, accent: BRAND.amber },
    { icon: <EventIcon />, label: "Upcoming games", value: stats?.upcoming_games ?? 0, accent: "#A78BFA" },
    { icon: <DoneAllIcon />, label: "Completed games", value: stats?.completed_games ?? 0, accent: "#38BDF8" },
    { icon: <InsightsIcon />, label: "Predictions", value: stats?.total_predictions ?? 0, accent: "#F472B6" },
    { icon: <PaidIcon />, label: "Prize pool", value: `Rs. ${(stats?.prize_pool ?? 0).toLocaleString()}`, accent: BRAND.amber },
  ];

  const teamData = (pstats?.most_predicted_teams || []).map((t) => ({ name: t.name, value: t.count }));
  const scoreData = (pstats?.most_predicted_scores || []).map((s) => ({ name: s.score, value: s.count }));

  return (
    <Box>
      <PageHeader title="Admin Overview" subtitle="League health, analytics and data controls."
        action={
          <Stack direction="row" spacing={1.5}>
            <Button variant="outlined" startIcon={<CalculateIcon />} disabled={recalc.isPending} onClick={() => recalc.mutate()}>
              Recalculate
            </Button>
            <Button variant="contained" startIcon={<SyncIcon />} disabled={sync.isPending} onClick={() => sync.mutate()}>
              {sync.isPending ? "Syncing…" : "Sync now"}
            </Button>
          </Stack>
        }
      />

      {isLoading ? (
        <Grid container spacing={2.5}>{cards.map((_, i) => <Grid item xs={6} md={3} key={i}><CardSkeleton height={96} /></Grid>)}</Grid>
      ) : (
        <Grid container spacing={2.5}>
          {cards.map((c) => (
            <Grid item xs={6} sm={4} md={3} key={c.label}><StatCard {...c} /></Grid>
          ))}
        </Grid>
      )}

      <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
        <Grid item xs={12} md={6}>
          <GlassCard sx={{ height: 340 }}>
            <Typography variant="h6" gutterBottom>Most predicted winners</Typography>
            <ResponsiveContainer width="100%" height={270}>
              <BarChart data={teamData} margin={{ left: -18, right: 8 }}>
                <XAxis dataKey="name" stroke={theme.palette.text.secondary} fontSize={11} interval={0} angle={-20} textAnchor="end" height={54} />
                <YAxis stroke={theme.palette.text.secondary} fontSize={12} allowDecimals={false} />
                <RTooltip contentStyle={{ background: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 12 }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {teamData.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </GlassCard>
        </Grid>
        <Grid item xs={12} md={6}>
          <GlassCard sx={{ height: 340 }}>
            <Typography variant="h6" gutterBottom>Most predicted scorelines</Typography>
            <ResponsiveContainer width="100%" height={270}>
              <BarChart data={scoreData} margin={{ left: -18, right: 8 }}>
                <XAxis dataKey="name" stroke={theme.palette.text.secondary} fontSize={12} />
                <YAxis stroke={theme.palette.text.secondary} fontSize={12} allowDecimals={false} />
                <RTooltip contentStyle={{ background: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 12 }} />
                <Bar dataKey="value" fill={BRAND.amber} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </GlassCard>
        </Grid>

        <Grid item xs={12}>
          <GlassCard>
            <Typography variant="h6" gutterBottom>Scheduler activity</Typography>
            <Stack spacing={1} sx={{ maxHeight: 240, overflowY: "auto" }}>
              {(logs || []).map((l: any) => (
                <Stack key={l.id} direction="row" spacing={1.5} alignItems="center" justifyContent="space-between"
                       sx={{ p: 1, borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Chip size="small" color={l.status === "success" ? "success" : "error"} label={l.status} />
                    <Typography variant="body2" fontWeight={600}>{l.job}</Typography>
                    <Typography variant="body2" color="text.secondary">{l.message}</Typography>
                  </Stack>
                  <Typography variant="caption" color="text.secondary">{new Date(l.at).toLocaleString()}</Typography>
                </Stack>
              ))}
              {!logs?.length && <Typography color="text.secondary" variant="body2">No scheduler runs recorded yet.</Typography>}
            </Stack>
          </GlassCard>
        </Grid>
      </Grid>
    </Box>
  );
}
