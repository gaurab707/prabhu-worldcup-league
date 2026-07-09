import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert, Avatar, Box, Button, Chip, Divider, Grid, Paper, Stack, TextField,
  Typography, useTheme,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import SaveIcon from "@mui/icons-material/Save";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import CelebrationIcon from "@mui/icons-material/Celebration";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { useState } from "react";
import { winnerApi, settingsApi, leaderboardApi, assetUrl, errMsg } from "../../api/client";
import { GlassCard, PageHeader } from "../../components/ui";
import { BRAND } from "../../theme/theme";

const MEDALS = ["🥇", "🥈", "🥉"];
const MEDAL_LABEL = ["Champion", "Runner-up", "Third place"];

export default function AdminWinner() {
  const theme = useTheme();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const qrRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  const { data: settings } = useQuery({ queryKey: ["public-settings"], queryFn: settingsApi.publicSettings });
  const { data: top } = useQuery({ queryKey: ["leaderboard", "top3"], queryFn: () => leaderboardApi.get({ limit: 3 }) });
  const { data: published } = useQuery({ queryKey: ["winners"], queryFn: winnerApi.list });

  const isRevealed = (published?.length ?? 0) > 0;

  // ----- settings state -----
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
  const reveal = useMutation({
    mutationFn: winnerApi.reveal,
    onSuccess: (w) => {
      qc.invalidateQueries({ queryKey: ["winners"] });
      if (w.length) {
        enqueueSnackbar("Winners revealed! 🎉", { variant: "success" });
        nav("/winners"); // jump straight to the animated podium
      } else {
        enqueueSnackbar("No ranked players yet — nothing to reveal.", { variant: "warning" });
      }
    },
    onError: (e) => enqueueSnackbar(errMsg(e), { variant: "error" }),
  });
  const hide = useMutation({
    mutationFn: winnerApi.hide,
    onSuccess: () => { enqueueSnackbar("Winners hidden.", { variant: "info" }); qc.invalidateQueries({ queryKey: ["winners"] }); },
  });

  const onQr = (e: any) => { const f = e.target.files?.[0]; if (f) { const fd = new FormData(); fd.append("file", f); uploadQr.mutate(fd); } };
  const onLogo = (e: any) => { const f = e.target.files?.[0]; if (f) { const fd = new FormData(); fd.append("file", f); uploadLogo.mutate(fd); } };

  return (
    <Box>
      <PageHeader title="Winners & Prizes"
        subtitle="Winners are calculated automatically from the leaderboard. Reveal them when the tournament ends." />

      <Grid container spacing={2.5}>
        {/* Auto podium / reveal control */}
        <Grid item xs={12} md={7}>
          <GlassCard>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <EmojiEventsIcon color="secondary" /><Typography variant="h6">Final podium</Typography>
              <Chip size="small" sx={{ ml: 1 }} color={isRevealed ? "success" : "default"}
                    label={isRevealed ? "Revealed to everyone" : "Not revealed yet"} />
            </Stack>
            <Alert severity="info" sx={{ mb: 2 }}>
              These are the current top three by total points. Clicking <b>Reveal winners</b> publishes
              them to the Winners page with a celebration for all players. You can re-reveal any time to
              refresh the standings, or hide them again.
            </Alert>

            <Stack spacing={1.5}>
              {(top || []).map((r, i) => (
                <Paper key={r.user_id} elevation={0}
                  sx={{ p: 1.75, display: "flex", alignItems: "center", gap: 1.5,
                        border: `1px solid ${theme.palette.divider}`, borderLeft: `5px solid ${BRAND.amber}` }}>
                  <Typography sx={{ fontSize: 30, width: 40, textAlign: "center" }}>{MEDALS[i]}</Typography>
                  <Avatar sx={{ bgcolor: "primary.main" }}>{r.name[0]}</Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography fontWeight={700} noWrap>{r.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{MEDAL_LABEL[i]} · {r.department || "—"}</Typography>
                  </Box>
                  <Chip color="secondary" label={`${r.points} pts`} />
                </Paper>
              ))}
              {!top?.length && (
                <Typography color="text.secondary" variant="body2" sx={{ py: 2 }}>
                  No ranked players yet. Once matches are scored, the top three will appear here.
                </Typography>
              )}
            </Stack>

            <Stack direction="row" spacing={1.5} sx={{ mt: 2.5 }}>
              <Button variant="contained" color="secondary" size="large" startIcon={<CelebrationIcon />}
                disabled={reveal.isPending || !top?.length} onClick={() => reveal.mutate()}>
                {isRevealed ? "Re-reveal winners" : "Reveal winners"}
              </Button>
              {isRevealed && (
                <Button variant="outlined" startIcon={<VisibilityOffIcon />}
                  disabled={hide.isPending} onClick={() => hide.mutate()}>
                  Hide
                </Button>
              )}
            </Stack>
          </GlassCard>
        </Grid>

        {/* Branding & payment settings */}
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
