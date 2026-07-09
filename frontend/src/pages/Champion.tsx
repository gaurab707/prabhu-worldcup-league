import { useMemo, useState } from "react";
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogContentText,
  DialogTitle, Divider, Grid, InputAdornment, Stack, TextField, Typography, useTheme, alpha,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import LockIcon from "@mui/icons-material/Lock";
import SearchIcon from "@mui/icons-material/Search";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import WorkspacePremiumIcon from "@mui/icons-material/WorkspacePremium";
import { fmt } from "../lib/time";
import { championApi, errMsg } from "../api/client";
import type { Team } from "../api/types";
import { GlassCard, PageHeader, TeamFlag, CardSkeleton } from "../components/ui";
import { BRAND } from "../theme/theme";

/** Prominent prize banner shown at the top of the page. */
function PrizeBanner({ bonus, prize, prizeAmount }: { bonus: number; prize?: string | null; prizeAmount?: number | null }) {
  const theme = useTheme();
  return (
    <Box sx={{ textAlign: "center", mb: 3, py: 3.5, borderRadius: 4,
      background: `linear-gradient(135deg, ${alpha(BRAND.amber, 0.20)}, ${alpha(BRAND.azure, 0.12)})`,
      border: `1px solid ${theme.palette.divider}` }}>
      <Typography sx={{ fontSize: 46, lineHeight: 1 }}>🏆</Typography>
      <Typography variant="h4" sx={{ fontWeight: 800, mt: 1 }}>Predict the World Cup Champion</Typography>
      <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 560, mx: "auto" }}>
        Pick the country you think will lift the trophy. You get <b>one</b> pick and it&rsquo;s locked forever.
      </Typography>
      <Stack direction="row" spacing={1.5} justifyContent="center" sx={{ mt: 2 }} flexWrap="wrap" useFlexGap>
        <Chip color="secondary" icon={<WorkspacePremiumIcon />} label={`+${bonus} bonus points if correct`} sx={{ fontWeight: 700 }} />
        {prize && (
          <Chip variant="outlined" icon={<EmojiEventsIcon />}
                label={prize + (prizeAmount ? ` · Rs. ${prizeAmount}` : "")} />
        )}
      </Stack>
    </Box>
  );
}

/** Grid of selectable country cards with a search box. */
function TeamPicker({ teams, selectedId, onSelect }: { teams: Team[]; selectedId: number | null; onSelect: (t: Team) => void }) {
  const theme = useTheme();
  const [q, setQ] = useState("");
  const filtered = useMemo(
    () => teams.filter((t) => t.name.toLowerCase().includes(q.trim().toLowerCase())),
    [teams, q],
  );

  return (
    <Box>
      <TextField
        fullWidth size="small" placeholder="Search countries…" value={q}
        onChange={(e) => setQ(e.target.value)} sx={{ mb: 2 }}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
      />
      <Grid container spacing={1.25} sx={{ maxHeight: 420, overflowY: "auto", pr: 0.5 }}>
        {filtered.map((t) => {
          const active = selectedId === t.id;
          return (
            <Grid item xs={6} sm={4} md={3} key={t.id}>
              <Box
                onClick={() => onSelect(t)}
                sx={{
                  p: 1.25, borderRadius: 3, cursor: "pointer", height: "100%",
                  display: "flex", alignItems: "center", gap: 1.25,
                  border: `1.5px solid ${active ? BRAND.azure : theme.palette.divider}`,
                  background: active ? `${BRAND.azure}1f` : "transparent",
                  transition: "all 0.15s ease",
                  "&:hover": { borderColor: BRAND.azure, background: `${BRAND.azure}12` },
                }}
              >
                <TeamFlag team={t} size={30} />
                <Typography variant="body2" fontWeight={active ? 700 : 500} noWrap>{t.name}</Typography>
              </Box>
            </Grid>
          );
        })}
        {!filtered.length && (
          <Grid item xs={12}><Typography color="text.secondary" sx={{ py: 2 }}>No countries match &ldquo;{q}&rdquo;.</Typography></Grid>
        )}
      </Grid>
    </Box>
  );
}

export default function Champion() {
  const theme = useTheme();
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [selected, setSelected] = useState<Team | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: status, isLoading } = useQuery({ queryKey: ["champion-status"], queryFn: championApi.status });
  const { data: teams } = useQuery({ queryKey: ["champion-teams"], queryFn: championApi.teams });

  const pick = useMutation({
    mutationFn: (teamId: number) => championApi.pick(teamId),
    onSuccess: () => {
      enqueueSnackbar("Champion locked in! 🏆", { variant: "success" });
      setConfirmOpen(false);
      qc.invalidateQueries({ queryKey: ["champion-status"] });
    },
    onError: (e) => { enqueueSnackbar(errMsg(e), { variant: "error" }); setConfirmOpen(false); },
  });

  if (isLoading || !status) {
    return (
      <Box>
        <PageHeader title="World Cup Winner" subtitle="Predict the champion." />
        <CardSkeleton height={180} />
      </Box>
    );
  }

  const myPick = status.my_pick;
  const settled = status.is_settled;

  return (
    <Box>
      <PageHeader title="World Cup Winner" subtitle="Your one-time prediction for the tournament champion." />

      <PrizeBanner bonus={status.bonus_points} prize={status.prize} prizeAmount={status.prize_amount} />

      {/* ---------- Already settled: show the result ---------- */}
      {settled && myPick && (
        <GlassCard sx={{ mb: 2.5,
          borderLeft: `6px solid ${myPick.is_correct ? BRAND.pitch : BRAND.danger}` }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={2} alignItems="center">
              {myPick.is_correct
                ? <CheckCircleIcon sx={{ fontSize: 48, color: BRAND.pitch }} />
                : <CancelIcon sx={{ fontSize: 48, color: BRAND.danger }} />}
              <Box>
                <Typography variant="h6">
                  {myPick.is_correct ? "You called it! 🎉" : "Not this time"}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                  <Typography color="text.secondary">You picked</Typography>
                  <TeamFlag team={myPick.team} size={22} />
                  <Typography fontWeight={700}>{myPick.team.name}</Typography>
                </Stack>
              </Box>
            </Stack>
            {myPick.is_correct && (
              <Chip color="success" sx={{ fontWeight: 800, fontSize: 15, py: 2, px: 1 }}
                    label={`+${myPick.points_awarded} pts`} />
            )}
          </Stack>
          {status.actual_team && (
            <>
              <Divider sx={{ my: 2 }} />
              <Stack direction="row" spacing={1.25} alignItems="center" justifyContent="center">
                <Typography color="text.secondary">World Cup Champion:</Typography>
                <TeamFlag team={status.actual_team} size={26} />
                <Typography fontWeight={800}>{status.actual_team.name}</Typography>
              </Stack>
            </>
          )}
        </GlassCard>
      )}

      {/* ---------- Has a pick (not yet settled): locked display ---------- */}
      {!settled && myPick && (
        <GlassCard sx={{ borderLeft: `6px solid ${BRAND.amber}` }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <TeamFlag team={myPick.team} size={56} />
            <Box sx={{ flex: 1 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="h6">{myPick.team.name}</Typography>
                <Chip size="small" icon={<LockIcon sx={{ fontSize: 15 }} />} label="Locked" color="warning" />
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Your champion pick, locked on {fmt(myPick.created_at, "MMM D, YYYY")}. This cannot be changed.
              </Typography>
            </Box>
          </Stack>
          <Alert severity="info" sx={{ mt: 2 }}>
            Sit tight — when the tournament ends and the admin declares the winner, you&rsquo;ll earn
            <b> {status.bonus_points} bonus points</b> if {myPick.team.name} are champions.
          </Alert>
        </GlassCard>
      )}

      {/* ---------- No pick yet, window open: the picker ---------- */}
      {!myPick && status.is_open && (
        <GlassCard>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <EmojiEventsIcon color="secondary" />
            <Typography variant="h6">Choose your champion</Typography>
          </Stack>
          <Alert severity="warning" icon={<LockIcon />} sx={{ mb: 2 }}>
            You can only pick <b>once</b>, and your choice is <b>permanent</b> — it can never be changed.
            {status.deadline && <> Picks close <b>{fmt(status.deadline, "ddd MMM D, HH:mm")}</b>.</>}
          </Alert>
          <TeamPicker teams={teams || []} selectedId={selected?.id ?? null} onSelect={setSelected} />
          <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
            <Button variant="contained" size="large" startIcon={<LockIcon />}
                    disabled={!selected} onClick={() => setConfirmOpen(true)}>
              {selected ? `Lock in ${selected.name}` : "Select a country"}
            </Button>
          </Stack>
        </GlassCard>
      )}

      {/* ---------- No pick, window closed ---------- */}
      {!myPick && !status.is_open && !settled && (
        <GlassCard sx={{ textAlign: "center", py: 6 }}>
          <LockIcon sx={{ fontSize: 60, color: "text.secondary", opacity: 0.4 }} />
          <Typography variant="h6" sx={{ mt: 2 }}>Champion picks are closed</Typography>
          <Typography color="text.secondary">
            The window to predict the World Cup winner isn&rsquo;t open right now.
          </Typography>
        </GlassCard>
      )}

      {/* ---------- Confirmation dialog (permanence) ---------- */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Confirm your champion</DialogTitle>
        <DialogContent>
          {selected && (
            <Stack alignItems="center" spacing={1.5} sx={{ py: 1 }}>
              <TeamFlag team={selected} size={64} />
              <Typography variant="h6">{selected.name}</Typography>
            </Stack>
          )}
          <DialogContentText sx={{ mt: 1 }}>
            This is your <b>final, permanent</b> pick for the World Cup champion. It <b>cannot be changed</b> afterwards.
            Are you sure?
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmOpen(false)} disabled={pick.isPending}>Cancel</Button>
          <Button variant="contained" startIcon={<LockIcon />} disabled={pick.isPending}
                  onClick={() => selected && pick.mutate(selected.id)}>
            {pick.isPending ? "Locking…" : "Lock it in"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
