import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert, Avatar, Box, Button, Chip, Divider, Grid, InputAdornment, Paper, Stack,
  TextField, Typography, useTheme,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import SaveIcon from "@mui/icons-material/Save";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import CelebrationIcon from "@mui/icons-material/Celebration";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { winnerApi, settingsApi, leaderboardApi, assetUrl, errMsg } from "../../api/client";
import type { Winner } from "../../api/types";
import { GlassCard, PageHeader } from "../../components/ui";
import { PlayerBreakdown } from "../../components/PointsBreakdown";
import { BRAND } from "../../theme/theme";

const MEDALS = ["🥇", "🥈", "🥉"];
const MEDAL_LABEL = ["Champion", "Runner-up", "Third place"];

/** One editable podium row: prize name + amount + note, with its breakdown. */
function WinnerEditor({ w, index, onSave, saving }:
  { w: Winner; index: number; onSave: (id: number, body: any) => void; saving: boolean }) {
  const theme = useTheme();
  const [prize, setPrize] = useState(w.prize ?? "");
  const [amount, setAmount] = useState<number | "">(w.prize_amount ?? "");
  const [notes, setNotes] = useState(w.notes ?? "");
  // Re-sync when the underlying winner changes (e.g. after regenerate).
  useEffect(() => { setPrize(w.prize ?? ""); setAmount(w.prize_amount ?? ""); setNotes(w.notes ?? ""); },
    [w.id, w.prize, w.prize_amount, w.notes]);

  const dirty = prize !== (w.prize ?? "") || String(amount) !== String(w.prize_amount ?? "") || notes !== (w.notes ?? "");

  return (
    <Paper elevation={0} sx={{ p: 2, border: `1px solid ${theme.palette.divider}`,
      borderLeft: `5px solid ${BRAND.amber}`, borderRadius: "10px" }}>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
        <Typography sx={{ fontSize: 28, width: 36, textAlign: "center" }}>{MEDALS[index]}</Typography>
        <Avatar sx={{ bgcolor: "primary.main" }}>{w.name[0]}</Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography fontWeight={700} noWrap>{w.name}</Typography>
          <Typography variant="caption" color="text.secondary">{MEDAL_LABEL[index]}</Typography>
        </Box>
        <Chip color="secondary" label={`${w.points} pts`} />
      </Stack>

      <Grid container spacing={1.5}>
        <Grid item xs={12} sm={5}>
          <TextField fullWidth size="small" label="Prize" value={prize}
            onChange={(e) => setPrize(e.target.value)} placeholder="e.g. Champion" />
        </Grid>
        <Grid item xs={7} sm={4}>
          <TextField fullWidth size="small" label="Amount" type="number" value={amount}
            onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
            InputProps={{ startAdornment: <InputAdornment position="start">Rs.</InputAdornment> }} />
        </Grid>
        <Grid item xs={5} sm={3}>
          <Button fullWidth variant={dirty ? "contained" : "outlined"} startIcon={<SaveIcon />}
            disabled={saving || !dirty} sx={{ height: "100%" }}
            onClick={() => onSave(w.id, { prize, prize_amount: amount === "" ? 0 : Number(amount), notes })}>
            Save
          </Button>
        </Grid>
        <Grid item xs={12}>
          <TextField fullWidth size="small" label="Note (optional)" value={notes}
            onChange={(e) => setNotes(e.target.value)} placeholder="Shown under the winner on the podium" />
        </Grid>
      </Grid>

      <PlayerBreakdown userId={w.user_id} />
    </Paper>
  );
}

export default function AdminWinner() {
  const theme = useTheme();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const qrRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  const { data: settings } = useQuery({ queryKey: ["public-settings"], queryFn: settingsApi.publicSettings });
  const { data: top } = useQuery({ queryKey: ["leaderboard", "top3"], queryFn: () => leaderboardApi.get({ limit: 3 }) });
  const { data: winners } = useQuery({ queryKey: ["winners-admin"], queryFn: winnerApi.adminList });

  const hasDraft = (winners?.length ?? 0) > 0;
  const isRevealed = (winners ?? []).some((w) => w.published);

  const refreshWinners = () => {
    qc.invalidateQueries({ queryKey: ["winners-admin"] });
    qc.invalidateQueries({ queryKey: ["winners"] });
  };

  const generate = useMutation({
    mutationFn: winnerApi.generate,
    onSuccess: (w) => {
      refreshWinners();
      enqueueSnackbar(w.length ? "Podium generated (draft — only you can see it)" : "No ranked players yet.",
        { variant: w.length ? "success" : "warning" });
    },
    onError: (e) => enqueueSnackbar(errMsg(e), { variant: "error" }),
  });
  const editWinner = useMutation({
    mutationFn: ({ id, body }: { id: number; body: any }) => winnerApi.edit(id, body),
    onSuccess: () => { enqueueSnackbar("Prize saved", { variant: "success" }); refreshWinners(); },
    onError: (e) => enqueueSnackbar(errMsg(e), { variant: "error" }),
  });
  const reveal = useMutation({
    mutationFn: winnerApi.reveal,
    onSuccess: (w) => {
      refreshWinners();
      if (w.length) { enqueueSnackbar("Winners revealed to everyone! 🎉", { variant: "success" }); nav("/winners"); }
      else enqueueSnackbar("No ranked players yet — nothing to reveal.", { variant: "warning" });
    },
    onError: (e) => enqueueSnackbar(errMsg(e), { variant: "error" }),
  });
  const hide = useMutation({
    mutationFn: winnerApi.hide,
    onSuccess: () => { enqueueSnackbar("Winners hidden — back to draft.", { variant: "info" }); refreshWinners(); },
  });

  // ----- branding/payment settings -----
  const [payMsg, setPayMsg] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const payMsgValue = payMsg ?? settings?.payment_message ?? "";
  const bannerValue = banner ?? settings?.winner_banner_text ?? "";
  const uploadQr = useMutation({
    mutationFn: (f: FormData) => settingsApi.uploadQr(f),
    onSuccess: () => { enqueueSnackbar("Payment QR updated", { variant: "success" }); qc.invalidateQueries({ queryKey: ["public-settings"] }); },
    onError: (e) => enqueueSnackbar(errMsg(e), { variant: "error" }),
  });
  const uploadLogo = useMutation({
    mutationFn: (f: FormData) => settingsApi.uploadLogo(f),
    onSuccess: () => { enqueueSnackbar("Logo updated", { variant: "success" }); qc.invalidateQueries({ queryKey: ["public-settings"] }); },
    onError: (e) => enqueueSnackbar(errMsg(e), { variant: "error" }),
  });
  const saveText = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => settingsApi.setText(key, value),
    onSuccess: () => { enqueueSnackbar("Settings saved", { variant: "success" }); qc.invalidateQueries({ queryKey: ["public-settings"] }); },
  });
  const onQr = (e: any) => { const f = e.target.files?.[0]; if (f) { const fd = new FormData(); fd.append("file", f); uploadQr.mutate(fd); } };
  const onLogo = (e: any) => { const f = e.target.files?.[0]; if (f) { const fd = new FormData(); fd.append("file", f); uploadLogo.mutate(fd); } };

  return (
    <Box>
      <PageHeader title="Winners & Prizes"
        subtitle="Generate the podium, set each prize, review how the points were earned, then reveal to everyone." />

      <Grid container spacing={2.5}>
        <Grid item xs={12} md={7}>
          <GlassCard>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <EmojiEventsIcon color="secondary" /><Typography variant="h6">Final podium</Typography>
              <Chip size="small" sx={{ ml: 1 }} color={isRevealed ? "success" : hasDraft ? "warning" : "default"}
                    label={isRevealed ? "Revealed to everyone" : hasDraft ? "Draft — only you can see it" : "Not generated yet"} />
            </Stack>

            {!hasDraft && (
              <>
                <Alert severity="info" sx={{ mb: 2 }}>
                  Generate the podium from the current standings. It stays a private <b>draft</b> so you can set the
                  prizes and check the points breakdown before revealing it to everyone.
                </Alert>
                <Stack spacing={1} sx={{ mb: 2 }}>
                  {(top || []).map((r, i) => (
                    <Stack key={r.user_id} direction="row" spacing={1.5} alignItems="center">
                      <Typography sx={{ fontSize: 22, width: 30, textAlign: "center" }}>{MEDALS[i]}</Typography>
                      <Typography sx={{ flex: 1 }} noWrap>{r.name}</Typography>
                      <Chip size="small" variant="outlined" label={`${r.points} pts`} />
                    </Stack>
                  ))}
                  {!top?.length && <Typography color="text.secondary" variant="body2">No ranked players yet.</Typography>}
                </Stack>
                <Button variant="contained" color="secondary" size="large" startIcon={<AutoAwesomeIcon />}
                  disabled={generate.isPending || !top?.length} onClick={() => generate.mutate()}>
                  Generate podium & prizes
                </Button>
              </>
            )}

            {hasDraft && (
              <>
                {isRevealed
                  ? <Alert severity="success" sx={{ mb: 2 }}>This podium is live on the Winners page for everyone, including the points breakdown. You can still edit prizes, or hide it.</Alert>
                  : <Alert severity="warning" sx={{ mb: 2 }}>Draft — only admins can see this. Set the prizes below, then <b>Reveal</b> to publish it to everyone.</Alert>}

                <Stack spacing={2}>
                  {(winners || []).map((w, i) => (
                    <WinnerEditor key={w.id} w={w} index={i} saving={editWinner.isPending}
                      onSave={(id, body) => editWinner.mutate({ id, body })} />
                  ))}
                </Stack>

                <Stack direction="row" spacing={1.5} sx={{ mt: 2.5 }} flexWrap="wrap" useFlexGap>
                  <Button variant="contained" color="secondary" size="large" startIcon={<CelebrationIcon />}
                    disabled={reveal.isPending} onClick={() => reveal.mutate()}>
                    {isRevealed ? "Re-publish" : "Reveal to everyone"}
                  </Button>
                  <Button variant="outlined" startIcon={<AutoAwesomeIcon />}
                    disabled={generate.isPending} onClick={() => generate.mutate()}>
                    Refresh from standings
                  </Button>
                  {isRevealed && (
                    <Button variant="outlined" color="warning" startIcon={<VisibilityOffIcon />}
                      disabled={hide.isPending} onClick={() => hide.mutate()}>
                      Hide
                    </Button>
                  )}
                </Stack>
              </>
            )}
          </GlassCard>
        </Grid>

        {/* Branding & payment settings (unchanged) */}
        <Grid item xs={12} md={5}>
          <GlassCard>
            <Typography variant="h6" gutterBottom>Payment & branding</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              The payment QR and message here are what new members see on the registration screen.
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Paper elevation={0} sx={{ p: 1.5, textAlign: "center", border: `1px solid ${theme.palette.divider}` }}>
                  <Typography variant="caption" color="text.secondary">Payment QR</Typography>
                  <Box sx={{ height: 110, my: 1, display: "grid", placeItems: "center" }}>
                    {settings?.payment_qr_url
                      ? <Box component="img" src={assetUrl(settings.payment_qr_url)} sx={{ maxHeight: 110, maxWidth: "100%", background: "#fff", borderRadius: 1, p: 0.5 }} />
                      : <Typography variant="caption" color="text.secondary">None yet</Typography>}
                  </Box>
                  <input ref={qrRef} type="file" accept="image/*" hidden onChange={onQr} />
                  <Button size="small" fullWidth startIcon={<CloudUploadIcon />} onClick={() => qrRef.current?.click()}>Upload</Button>
                </Paper>
              </Grid>
              <Grid item xs={6}>
                <Paper elevation={0} sx={{ p: 1.5, textAlign: "center", border: `1px solid ${theme.palette.divider}` }}>
                  <Typography variant="caption" color="text.secondary">Company logo</Typography>
                  <Box sx={{ height: 110, my: 1, display: "grid", placeItems: "center" }}>
                    <Box component="img" src={assetUrl(settings?.company_logo_url) || "https://www.prabhucapital.com/brand-logo.png"}
                         sx={{ maxHeight: 70, maxWidth: "100%", background: "#fff", borderRadius: 1, p: 0.5 }} />
                  </Box>
                  <input ref={logoRef} type="file" accept="image/*" hidden onChange={onLogo} />
                  <Button size="small" fullWidth startIcon={<CloudUploadIcon />} onClick={() => logoRef.current?.click()}>Upload</Button>
                </Paper>
              </Grid>
            </Grid>
            <TextField label="Payment instructions" fullWidth multiline minRows={2} sx={{ mt: 2 }}
              value={payMsgValue} onChange={(e) => setPayMsg(e.target.value)} />
            <Button size="small" startIcon={<SaveIcon />} sx={{ mt: 1 }}
              onClick={() => saveText.mutate({ key: "payment_message", value: payMsgValue })}>Save message</Button>
            <Divider sx={{ my: 2 }} />
            <TextField label="Winner banner text" fullWidth
              value={bannerValue} onChange={(e) => setBanner(e.target.value)} />
            <Button size="small" startIcon={<SaveIcon />} sx={{ mt: 1 }}
              onClick={() => saveText.mutate({ key: "winner_banner_text", value: bannerValue })}>Save banner</Button>
          </GlassCard>
        </Grid>
      </Grid>
    </Box>
  );
}
