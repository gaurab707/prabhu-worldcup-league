import { useEffect, useState } from "react";
import {
  Box, Button, Chip, Divider, Grid, IconButton, Stack, Tab, Tabs, Tooltip,
  Typography, useTheme,
} from "@mui/material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import PlaceIcon from "@mui/icons-material/Place";
import SaveIcon from "@mui/icons-material/Save";
import dayjs from "dayjs";
import { matchApi, predictionApi, errMsg } from "../api/client";
import type { Match } from "../api/types";
import { GlassCard, PageHeader, TeamFlag, CardSkeleton } from "../components/ui";
import Countdown from "../components/Countdown";
import { BRAND } from "../theme/theme";

function isKnockout(m: Match) {
  const r = (m.round_name || "").toLowerCase();
  return m.is_penalty || ["final", "semi", "quarter", "round of 16", "round of"].some((k) => r.includes(k));
}

function Stepper({ value, onChange, disabled }: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <Stack direction="row" alignItems="center" spacing={0.5}>
      <IconButton size="small" disabled={disabled || value <= 0} onClick={() => onChange(value - 1)}
                  sx={{ border: "1px solid", borderColor: "divider" }}>
        <RemoveIcon fontSize="small" />
      </IconButton>
      <Typography sx={{ width: 30, textAlign: "center", fontWeight: 800, fontSize: 20 }}>{value}</Typography>
      <IconButton size="small" disabled={disabled} onClick={() => onChange(value + 1)}
                  sx={{ border: "1px solid", borderColor: "divider" }}>
        <AddIcon fontSize="small" />
      </IconButton>
    </Stack>
  );
}

function PredictionCard({ match }: { match: Match }) {
  const theme = useTheme();
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const knockout = isKnockout(match);

  const [h, setH] = useState(match.my_prediction?.pred_home_score ?? 0);
  const [a, setA] = useState(match.my_prediction?.pred_away_score ?? 0);
  const [hp, setHp] = useState(match.my_prediction?.pred_home_penalty ?? 4);
  const [ap, setAp] = useState(match.my_prediction?.pred_away_penalty ?? 3);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setH(match.my_prediction?.pred_home_score ?? 0);
    setA(match.my_prediction?.pred_away_score ?? 0);
  }, [match.id]);

  const showPenalty = knockout && h === a; // shootout only relevant if regulation drawn

  const save = async () => {
    setSaving(true);
    try {
      await predictionApi.upsert({
        match_id: match.id, pred_home_score: h, pred_away_score: a,
        pred_home_penalty: showPenalty ? hp : null,
        pred_away_penalty: showPenalty ? ap : null,
      });
      enqueueSnackbar("Prediction saved", { variant: "success" });
      qc.invalidateQueries({ queryKey: ["matches"] });
      qc.invalidateQueries({ queryKey: ["staff-dashboard"] });
    } catch (e) {
      enqueueSnackbar(errMsg(e), { variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <GlassCard sx={{ height: "100%" }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Chip size="small" label={match.round_name || match.group_name || "Match"} />
        <Countdown target={match.kickoff_at} locked={match.is_locked} />
      </Stack>

      <Grid container alignItems="center" spacing={1} sx={{ my: 1 }}>
        <Grid item xs={4}>
          <Stack alignItems="center" spacing={0.75}>
            <TeamFlag team={match.home_team} size={46} />
            <Typography fontWeight={700} textAlign="center" variant="body2">{match.home_team.name}</Typography>
          </Stack>
        </Grid>
        <Grid item xs={4}>
          <Stack alignItems="center" spacing={1}>
            <Stepper value={h} onChange={setH} disabled={match.is_locked} />
            <Typography variant="caption" color="text.secondary">score</Typography>
            <Stepper value={a} onChange={setA} disabled={match.is_locked} />
          </Stack>
        </Grid>
        <Grid item xs={4}>
          <Stack alignItems="center" spacing={0.75}>
            <TeamFlag team={match.away_team} size={46} />
            <Typography fontWeight={700} textAlign="center" variant="body2">{match.away_team.name}</Typography>
          </Stack>
        </Grid>
      </Grid>

      {showPenalty && (
        <Box sx={{ mt: 1, p: 1.25, borderRadius: 2, background: `${BRAND.amber}14` }}>
          <Typography variant="caption" color="text.secondary" display="block" textAlign="center" sx={{ mb: 0.5 }}>
            Drawn in regulation — predict the shootout
          </Typography>
          <Stack direction="row" justifyContent="center" alignItems="center" spacing={2}>
            <Stepper value={hp} onChange={setHp} disabled={match.is_locked} />
            <Typography fontWeight={800}>:</Typography>
            <Stepper value={ap} onChange={setAp} disabled={match.is_locked} />
          </Stack>
        </Box>
      )}

      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 1.5, color: "text.secondary" }}>
        <PlaceIcon sx={{ fontSize: 15 }} />
        <Typography variant="caption" noWrap>{match.venue || "TBD"} · {dayjs(match.kickoff_at).format("ddd MMM D, HH:mm")}</Typography>
      </Stack>

      <Button fullWidth variant="contained" startIcon={<SaveIcon />} sx={{ mt: 1.5 }}
              disabled={match.is_locked || saving} onClick={save}>
        {match.is_locked ? "Locked" : match.my_prediction ? "Update prediction" : "Save prediction"}
      </Button>
    </GlassCard>
  );
}

function CompletedCard({ match }: { match: Match }) {
  const theme = useTheme();
  const p = match.my_prediction;
  return (
    <GlassCard>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Chip size="small" label={match.round_name || "Match"} />
        {p?.is_scored ? (
          <Chip size="small" color="success" label={`+${p.points_awarded} pts`} sx={{ fontWeight: 800 }} />
        ) : <Chip size="small" variant="outlined" label="Awaiting scoring" />}
      </Stack>
      <Grid container alignItems="center">
        <Grid item xs={5}><Stack direction="row" spacing={1} alignItems="center">
          <TeamFlag team={match.home_team} /><Typography fontWeight={600}>{match.home_team.short_code}</Typography>
        </Stack></Grid>
        <Grid item xs={2} textAlign="center">
          <Typography variant="h5" fontWeight={800}>{match.home_score}-{match.away_score}</Typography>
          {match.is_penalty && <Typography variant="caption" color="text.secondary">({match.home_penalty}-{match.away_penalty} pen)</Typography>}
        </Grid>
        <Grid item xs={5}><Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
          <Typography fontWeight={600}>{match.away_team.short_code}</Typography><TeamFlag team={match.away_team} />
        </Stack></Grid>
      </Grid>

      {p && (
        <>
          <Divider sx={{ my: 1.5 }} />
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="body2" color="text.secondary">
              You predicted <b style={{ color: theme.palette.text.primary }}>{p.pred_home_score}-{p.pred_away_score}</b>
            </Typography>
            {p.is_scored && (
              <Stack direction="row" spacing={0.5}>
                <Tooltip title="Outcome points"><Chip size="small" variant="outlined" label={`W ${p.outcome_points}`} /></Tooltip>
                <Tooltip title="Score closeness points"><Chip size="small" variant="outlined" label={`S ${p.closeness_points}`} /></Tooltip>
                {p.penalty_points > 0 && <Tooltip title="Penalty points"><Chip size="small" variant="outlined" label={`P ${p.penalty_points}`} /></Tooltip>}
                {p.difficulty_multiplier > 1 && <Tooltip title="Underdog bonus multiplier"><Chip size="small" color="warning" label={`×${p.difficulty_multiplier}`} /></Tooltip>}
              </Stack>
            )}
          </Stack>
        </>
      )}
    </GlassCard>
  );
}

export default function Predictions() {
  const [tab, setTab] = useState(0);
  const { data: upcoming, isLoading } = useQuery({ queryKey: ["matches", "upcoming"], queryFn: () => matchApi.list({ upcoming: true }) });
  const { data: finished } = useQuery({ queryKey: ["matches", "finished"], queryFn: () => matchApi.list({ status: "finished" }) });

  return (
    <Box>
      <PageHeader title="Predictions" subtitle="Lock in your scores before kickoff. Editable until the match starts." />
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label={`Upcoming (${upcoming?.length ?? 0})`} />
        <Tab label={`Completed (${finished?.length ?? 0})`} />
      </Tabs>

      {tab === 0 && (
        isLoading ? (
          <Grid container spacing={2.5}>{[0,1,2].map(i => <Grid item xs={12} md={6} lg={4} key={i}><CardSkeleton height={260} /></Grid>)}</Grid>
        ) : upcoming?.length ? (
          <Grid container spacing={2.5}>
            {upcoming.map((m) => <Grid item xs={12} md={6} lg={4} key={m.id}><PredictionCard match={m} /></Grid>)}
          </Grid>
        ) : <GlassCard><Typography color="text.secondary">No upcoming matches. Check back once the schedule updates.</Typography></GlassCard>
      )}

      {tab === 1 && (
        finished?.length ? (
          <Grid container spacing={2.5}>
            {finished.map((m) => <Grid item xs={12} md={6} key={m.id}><CompletedCard match={m} /></Grid>)}
          </Grid>
        ) : <GlassCard><Typography color="text.secondary">No completed matches yet.</Typography></GlassCard>
      )}
    </Box>
  );
}
