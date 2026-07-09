import { useEffect, useMemo, useState } from "react";
import {
  Alert, Autocomplete, Box, Button, Chip, Divider, FormControlLabel, Grid, LinearProgress,
  Paper, Stack, Switch, TextField, Typography, useTheme,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import SaveIcon from "@mui/icons-material/Save";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import GavelIcon from "@mui/icons-material/Gavel";
import ReplayIcon from "@mui/icons-material/Replay";
import GroupsIcon from "@mui/icons-material/Groups";
import { toInput, fromInput } from "../../lib/time";
import { championApi, errMsg } from "../../api/client";
import type { Team } from "../../api/types";
import { GlassCard, PageHeader, TeamFlag } from "../../components/ui";
import { BRAND } from "../../theme/theme";

export default function AdminChampion() {
  const theme = useTheme();
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const { data: summary } = useQuery({ queryKey: ["champion-admin"], queryFn: championApi.adminSummary });
  const { data: teams } = useQuery({ queryKey: ["champion-teams"], queryFn: championApi.teams });

  // --- config form state (initialised from summary) ---
  const [open, setOpen] = useState(false);
  const [deadline, setDeadline] = useState<string>("");
  const [bonus, setBonus] = useState<number>(500);
  const [prize, setPrize] = useState<string>("");
  const [prizeAmount, setPrizeAmount] = useState<number>(0);
  const [winner, setWinner] = useState<Team | null>(null);

  useEffect(() => {
    if (summary) {
      setOpen(summary.is_open);
      setDeadline(toInput(summary.deadline));
      setBonus(summary.bonus_points);
      setPrize(summary.prize ?? "");
      setPrizeAmount(summary.prize_amount ?? 0);
    }
  }, [summary]);

  const maxCount = useMemo(
    () => Math.max(1, ...((summary?.tally || []).map((t) => t.count))),
    [summary],
  );

  const saveConfig = useMutation({
    mutationFn: () => championApi.updateConfig({
      is_open: open,
      deadline: deadline ? fromInput(deadline) : undefined,
      clear_deadline: !deadline,
      bonus_points: Number(bonus),
      prize: prize,
      prize_amount: Number(prizeAmount),
    }),
    onSuccess: () => {
      enqueueSnackbar("Champion settings saved", { variant: "success" });
      qc.invalidateQueries({ queryKey: ["champion-admin"] });
      qc.invalidateQueries({ queryKey: ["champion-status"] });
    },
    onError: (e) => enqueueSnackbar(errMsg(e), { variant: "error" }),
  });

  const settle = useMutation({
    mutationFn: (teamId: number) => championApi.settle(teamId),
    onSuccess: () => {
      enqueueSnackbar("Champion declared — bonuses awarded! 🏆", { variant: "success" });
      qc.invalidateQueries({ queryKey: ["champion-admin"] });
      qc.invalidateQueries({ queryKey: ["champion-status"] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
    },
    onError: (e) => enqueueSnackbar(errMsg(e), { variant: "error" }),
  });

  const reopen = useMutation({
    mutationFn: () => championApi.reopen(),
    onSuccess: () => {
      enqueueSnackbar("Settlement undone. Bonuses cleared and picking re-opened.", { variant: "info" });
      qc.invalidateQueries({ queryKey: ["champion-admin"] });
      qc.invalidateQueries({ queryKey: ["champion-status"] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
    },
    onError: (e) => enqueueSnackbar(errMsg(e), { variant: "error" }),
  });

  const settled = summary?.is_settled;

  return (
    <Box>
      <PageHeader title="Champion Prize"
        subtitle="Configure the World Cup winner prediction, watch the picks, and declare the champion." />

      <Grid container spacing={2.5}>
        {/* ---------- Configuration ---------- */}
        <Grid item xs={12} md={6}>
          <GlassCard>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <EmojiEventsIcon color="secondary" /><Typography variant="h6">Prediction window & prize</Typography>
            </Stack>

            <FormControlLabel
              control={<Switch checked={open} disabled={settled} onChange={(e) => setOpen(e.target.checked)} />}
              label={open ? "Picking is OPEN" : "Picking is CLOSED"}
            />
            {settled && (
              <Alert severity="info" sx={{ my: 1 }}>
                The champion has been declared, so picking is closed. Use <b>Undo declaration</b> below to re-open.
              </Alert>
            )}

            <Stack spacing={2} sx={{ mt: 1.5 }}>
              <TextField
                label="Picks close at (optional)" type="datetime-local" size="small"
                value={deadline} onChange={(e) => setDeadline(e.target.value)}
                InputLabelProps={{ shrink: true }}
                helperText="Leave empty for no deadline. After this time, players can no longer pick."
              />
              <TextField
                label="Bonus points for a correct pick" type="number" size="small"
                value={bonus} onChange={(e) => setBonus(Number(e.target.value))}
                inputProps={{ min: 0 }}
              />
              <TextField
                label="Prize name" size="small" value={prize}
                onChange={(e) => setPrize(e.target.value)}
                placeholder="e.g. World Cup Champion Predictor"
              />
              <TextField
                label="Prize amount (Rs.)" type="number" size="small"
                value={prizeAmount} onChange={(e) => setPrizeAmount(Number(e.target.value))}
                inputProps={{ min: 0 }}
              />
              <Button variant="contained" startIcon={<SaveIcon />}
                      disabled={saveConfig.isPending} onClick={() => saveConfig.mutate()}>
                Save settings
              </Button>
            </Stack>
          </GlassCard>
        </Grid>

        {/* ---------- Declare champion ---------- */}
        <Grid item xs={12} md={6}>
          <GlassCard sx={{ height: "100%" }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <GavelIcon color="secondary" /><Typography variant="h6">Declare the champion</Typography>
            </Stack>

            {settled && summary?.actual_team ? (
              <Box>
                <Alert severity="success" sx={{ mb: 2 }}>Champion declared and bonuses awarded.</Alert>
                <Paper elevation={0} sx={{ p: 2, display: "flex", alignItems: "center", gap: 1.5,
                  border: `1px solid ${theme.palette.divider}`, borderLeft: `5px solid ${BRAND.pitch}` }}>
                  <TeamFlag team={summary.actual_team} size={44} />
                  <Box sx={{ flex: 1 }}>
                    <Typography fontWeight={800}>{summary.actual_team.name}</Typography>
                    <Typography variant="caption" color="text.secondary">World Cup Champion</Typography>
                  </Box>
                  <Chip color="secondary" label={`+${summary.bonus_points} pts each`} />
                </Paper>
                <Button fullWidth variant="outlined" color="warning" startIcon={<ReplayIcon />} sx={{ mt: 2 }}
                        disabled={reopen.isPending} onClick={() => reopen.mutate()}>
                  Undo declaration (clears bonuses & re-opens)
                </Button>
              </Box>
            ) : (
              <Box>
                <Alert severity="warning" sx={{ mb: 2 }}>
                  Do this only once the final is over. It awards <b>{bonus} points</b> to everyone who picked the
                  winner and folds them into the leaderboard.
                </Alert>
                <Autocomplete
                  options={teams || []}
                  getOptionLabel={(o) => o.name}
                  value={winner}
                  onChange={(_, v) => setWinner(v)}
                  renderInput={(params) => <TextField {...params} label="Winning country" size="small" />}
                  renderOption={(props, o) => (
                    <Box component="li" {...props} sx={{ display: "flex", gap: 1.25 }}>
                      <TeamFlag team={o} size={22} /> {o.name}
                    </Box>
                  )}
                />
                <Button fullWidth variant="contained" color="secondary" startIcon={<EmojiEventsIcon />} sx={{ mt: 2 }}
                        disabled={!winner || settle.isPending}
                        onClick={() => winner && settle.mutate(winner.id)}>
                  Declare {winner ? winner.name : "champion"} & award bonuses
                </Button>
              </Box>
            )}
          </GlassCard>
        </Grid>

        {/* ---------- Pick distribution ---------- */}
        <Grid item xs={12}>
          <GlassCard>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <GroupsIcon color="secondary" />
              <Typography variant="h6">Who picked whom</Typography>
              <Chip size="small" sx={{ ml: 1 }} label={`${summary?.total_picks ?? 0} total picks`} />
            </Stack>

            {summary?.tally?.length ? (
              <Stack spacing={1.5}>
                {summary.tally.map((t) => {
                  const isWinner = settled && summary.actual_team_id === t.team_id;
                  return (
                    <Box key={t.team_id}>
                      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 0.5 }}>
                        <TeamFlag team={{ id: t.team_id, name: t.name, short_code: t.short_code, flag_url: t.flag_url }} size={26} />
                        <Typography fontWeight={600} sx={{ flex: 1 }}>{t.name}</Typography>
                        {isWinner && <Chip size="small" color="success" label="Champion" />}
                        <Typography fontWeight={700} color="text.secondary">
                          {t.count} {t.count === 1 ? "pick" : "picks"}
                        </Typography>
                      </Stack>
                      <LinearProgress variant="determinate" value={(t.count / maxCount) * 100}
                        sx={{ height: 8, borderRadius: 4,
                          "& .MuiLinearProgress-bar": { background: isWinner ? BRAND.pitch : BRAND.azure } }} />
                    </Box>
                  );
                })}
              </Stack>
            ) : (
              <Typography color="text.secondary" sx={{ py: 2 }}>
                No champion picks yet. Once players choose their winner, the distribution appears here.
              </Typography>
            )}
          </GlassCard>
        </Grid>
      </Grid>
    </Box>
  );
}
