import { useState } from "react";
import {
  Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider,
  FormControlLabel, Grid, IconButton, MenuItem, Stack, Switch, Table, TableBody,
  TableCell, TableHead, TableRow, TextField, Tooltip, Typography, useTheme,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import LockIcon from "@mui/icons-material/Lock";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import VisibilityIcon from "@mui/icons-material/Visibility";
import ScoreboardIcon from "@mui/icons-material/Scoreboard";
import SyncIcon from "@mui/icons-material/Sync";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import { fmt, fromInput, nowInput } from "../../lib/time";
import { matchApi, adminApi, errMsg } from "../../api/client";
import type { Match } from "../../api/types";
import { GlassCard, PageHeader, TeamFlag } from "../../components/ui";
import { clearTableSx, tableCardSx } from "../../theme/theme";

const STATUS_COLORS: any = { scheduled: "primary", live: "warning", finished: "success", postponed: "default", cancelled: "error" };

export default function AdminGames() {
  const theme = useTheme();
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { data: matches } = useQuery({ queryKey: ["admin-matches"], queryFn: () => matchApi.list() });

  const [createOpen, setCreateOpen] = useState(false);
  const [editMatch, setEditMatch] = useState<Match | null>(null);
  const [clearOpen, setClearOpen] = useState(false);

  const invalidate = () => qc.invalidateQueries();

  const sync = useMutation({
    mutationFn: () => adminApi.syncNow(),
    onSuccess: (r: any) => { enqueueSnackbar(`Sync complete — ${r?.matches_changed ?? 0} fixtures updated`, { variant: "success" }); invalidate(); },
    onError: (e) => enqueueSnackbar(errMsg(e), { variant: "error" }),
  });
  const clear = useMutation({
    mutationFn: () => adminApi.clearMatches(),
    onSuccess: (r: any) => { enqueueSnackbar(`Cleared ${r?.matches_deleted ?? 0} fixtures`, { variant: "success" }); setClearOpen(false); invalidate(); },
    onError: (e) => enqueueSnackbar(errMsg(e), { variant: "error" }),
  });

  const create = useMutation({
    mutationFn: (b: any) => matchApi.create(b),
    onSuccess: () => { enqueueSnackbar("Match created", { variant: "success" }); setCreateOpen(false); invalidate(); },
    onError: (e) => enqueueSnackbar(errMsg(e), { variant: "error" }),
  });
  const update = useMutation({
    mutationFn: ({ id, body }: any) => matchApi.update(id, body),
    onSuccess: () => { enqueueSnackbar("Match updated", { variant: "success" }); setEditMatch(null); invalidate(); },
    onError: (e) => enqueueSnackbar(errMsg(e), { variant: "error" }),
  });
  const lock = useMutation({
    mutationFn: ({ id, l }: any) => matchApi.toggleLock(id, l),
    onSuccess: (_, v) => { enqueueSnackbar(v.l ? "Match locked" : "Match unlocked", { variant: "success" }); invalidate(); },
  });

  return (
    <Box>
      <PageHeader title="Manage Games" subtitle="Create fixtures, enter results, and control locking. Results trigger automatic rescoring."
        action={
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button variant="outlined" color="inherit" startIcon={<SyncIcon />} disabled={sync.isPending} onClick={() => sync.mutate()}>
              {sync.isPending ? "Syncing..." : "Sync now"}
            </Button>
            <Button variant="outlined" color="error" startIcon={<DeleteSweepIcon />} disabled={!matches?.length} onClick={() => setClearOpen(true)}>
              Clear all
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>New match</Button>
          </Stack>
        } />

      <GlassCard sx={tableCardSx(theme)}>
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 820, ...clearTableSx(theme) }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ pl: 3 }}>Fixture</TableCell>
                <TableCell>Round</TableCell>
                <TableCell>Kickoff</TableCell>
                <TableCell align="center">Score</TableCell>
                <TableCell align="center">Status</TableCell>
                <TableCell align="right" sx={{ pr: 3 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(matches || []).map((m) => (
                <TableRow key={m.id}>
                  <TableCell sx={{ pl: 3 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <TeamFlag team={m.home_team} size={26} />
                      <Typography variant="body2" fontWeight={600}>{m.home_team.short_code} v {m.away_team.short_code}</Typography>
                      <TeamFlag team={m.away_team} size={26} />
                    </Stack>
                  </TableCell>
                  <TableCell><Typography variant="body2" color="text.secondary">{m.round_name || "—"}</Typography></TableCell>
                  <TableCell><Typography variant="body2">{fmt(m.kickoff_at, "MMM D, HH:mm")}</Typography></TableCell>
                  <TableCell align="center">
                    {m.home_score != null ? (
                      <Typography fontWeight={700}>{m.home_score}-{m.away_score}{m.is_penalty ? ` (${m.home_penalty}-${m.away_penalty}p)` : ""}</Typography>
                    ) : <Typography color="text.secondary">—</Typography>}
                  </TableCell>
                  <TableCell align="center">
                    <Chip size="small" color={STATUS_COLORS[m.status]} label={m.status} />
                    {m.is_locked && <Chip size="small" variant="outlined" icon={<LockIcon sx={{ fontSize: 13 }} />} label="" sx={{ ml: 0.5 }} />}
                  </TableCell>
                  <TableCell align="right" sx={{ pr: 3 }}>
                    <Tooltip title="Enter result / edit"><IconButton size="small" onClick={() => setEditMatch(m)}><ScoreboardIcon fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title={m.manually_locked ? "Unlock predictions" : "Lock predictions"}>
                      <IconButton size="small" onClick={() => lock.mutate({ id: m.id, l: !m.manually_locked })}>
                        {m.manually_locked ? <LockOpenIcon fontSize="small" /> : <LockIcon fontSize="small" />}
                      </IconButton>
                    </Tooltip>
                    {m.status === "finished" && (
                      <Tooltip title={m.predictions_revealed ? "Predictions revealed" : "Reveal predictions to all"}>
                        <IconButton size="small" color={m.predictions_revealed ? "success" : "default"}
                          onClick={() => update.mutate({ id: m.id, body: { predictions_revealed: !m.predictions_revealed } })}>
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!matches?.length && <TableRow><TableCell colSpan={6} align="center" sx={{ py: 5, color: "text.secondary" }}>No matches yet. Create one or run a sync.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </Box>
      </GlassCard>

      <CreateDialog open={createOpen} onClose={() => setCreateOpen(false)} onSubmit={(b: any) => create.mutate(b)} loading={create.isPending} />
      <ResultDialog match={editMatch} onClose={() => setEditMatch(null)} onSubmit={(id: number, b: any) => update.mutate({ id, body: b })} loading={update.isPending} />

      <Dialog open={clearOpen} onClose={() => setClearOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Clear all fixtures?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This permanently deletes every fixture, all predictions, and all awarded
            points, and resets every player's total to zero. Teams are kept. This
            cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearOpen(false)}>Cancel</Button>
          <Button color="error" variant="contained" disabled={clear.isPending} onClick={() => clear.mutate()}>
            {clear.isPending ? "Clearing..." : "Yes, clear everything"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function CreateDialog({ open, onClose, onSubmit, loading }: any) {
  const [f, setF] = useState({ home_team: "", away_team: "", kickoff_at: nowInput(1), venue: "", round_name: "Group Stage", group_name: "" });
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create match</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 0 }}>
          <Grid item xs={6}><TextField label="Home team" fullWidth value={f.home_team} onChange={set("home_team")} /></Grid>
          <Grid item xs={6}><TextField label="Away team" fullWidth value={f.away_team} onChange={set("away_team")} /></Grid>
          <Grid item xs={12}><TextField label="Kickoff" type="datetime-local" fullWidth value={f.kickoff_at} onChange={set("kickoff_at")} InputLabelProps={{ shrink: true }} /></Grid>
          <Grid item xs={6}><TextField label="Round" fullWidth value={f.round_name} onChange={set("round_name")} /></Grid>
          <Grid item xs={6}><TextField label="Venue" fullWidth value={f.venue} onChange={set("venue")} /></Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={loading || !f.home_team || !f.away_team}
          onClick={() => onSubmit({ ...f, kickoff_at: fromInput(f.kickoff_at) })}>Create</Button>
      </DialogActions>
    </Dialog>
  );
}

function ResultDialog({ match, onClose, onSubmit, loading }: any) {
  const [f, setF] = useState<any>({});
  if (match && f.__id !== match.id) {
    setF({ __id: match.id, home_score: match.home_score ?? 0, away_score: match.away_score ?? 0,
      is_penalty: match.is_penalty, home_penalty: match.home_penalty ?? 0, away_penalty: match.away_penalty ?? 0,
      status: match.status });
  }
  if (!match) return null;
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  return (
    <Dialog open={!!match} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Result · {match.home_team.short_code} v {match.away_team.short_code}</DialogTitle>
      <DialogContent>
        <Typography variant="caption" color="text.secondary">Entering a final score marks the match finished and rescoring runs automatically.</Typography>
        <Stack direction="row" spacing={2} alignItems="center" justifyContent="center" sx={{ my: 2 }}>
          <TextField label={match.home_team.short_code} type="number" value={f.home_score} onChange={set("home_score")} sx={{ width: 90 }} />
          <Typography fontWeight={800}>–</Typography>
          <TextField label={match.away_team.short_code} type="number" value={f.away_score} onChange={set("away_score")} sx={{ width: 90 }} />
        </Stack>
        <FormControlLabel control={<Switch checked={!!f.is_penalty} onChange={(e) => setF({ ...f, is_penalty: e.target.checked })} />} label="Decided by penalty shootout" />
        {f.is_penalty && (
          <Stack direction="row" spacing={2} alignItems="center" justifyContent="center" sx={{ my: 1 }}>
            <TextField label="Home pens" type="number" value={f.home_penalty} onChange={set("home_penalty")} sx={{ width: 100 }} />
            <TextField label="Away pens" type="number" value={f.away_penalty} onChange={set("away_penalty")} sx={{ width: 100 }} />
          </Stack>
        )}
        <Divider sx={{ my: 2 }} />
        <TextField select label="Status" fullWidth value={f.status} onChange={set("status")}>
          {["scheduled", "live", "finished", "postponed", "cancelled"].map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
        </TextField>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={loading} onClick={() => onSubmit(match.id, {
          home_score: Number(f.home_score), away_score: Number(f.away_score),
          is_penalty: !!f.is_penalty, home_penalty: Number(f.home_penalty), away_penalty: Number(f.away_penalty),
          status: f.status,
        })}>Save result</Button>
      </DialogActions>
    </Dialog>
  );
}
