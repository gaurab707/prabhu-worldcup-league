import { Box, Chip, Divider, Grid, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import BadgeIcon from "@mui/icons-material/MilitaryTech";
import { userApi, predictionApi, paymentApi } from "../api/client";
import { GlassCard, PageHeader, StatCard } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { BRAND } from "../theme/theme";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import PercentIcon from "@mui/icons-material/Percent";
import ChecklistIcon from "@mui/icons-material/Checklist";

function badges(points: number, accuracy: number, played: number) {
  const list: { label: string; got: boolean }[] = [
    { label: "First Blood · scored a match", got: played >= 1 },
    { label: "Sharpshooter · 50%+ winner accuracy", got: accuracy >= 50 },
    { label: "Centurion · 100+ points", got: points >= 100 },
    { label: "Veteran · 5+ matches played", got: played >= 5 },
    { label: "Oracle · 300+ points", got: points >= 300 },
  ];
  return list;
}

export default function Profile() {
  const { user } = useAuth();
  const { data: dash } = useQuery({ queryKey: ["staff-dashboard"], queryFn: userApi.dashboard });
  const { data: preds } = useQuery({ queryKey: ["my-preds"], queryFn: predictionApi.mine });
  const { data: payment } = useQuery({ queryKey: ["my-payment"], queryFn: paymentApi.mine });

  const earned = badges(dash?.total_points ?? 0, dash?.accuracy ?? 0, dash?.played ?? 0);

  return (
    <Box>
      <PageHeader title="My Profile" subtitle="Your account, achievements and prediction record." />
      <Grid container spacing={2.5}>
        <Grid item xs={12} md={4}>
          <GlassCard>
            <Stack spacing={0.5} sx={{ mb: 2 }}>
              <Typography variant="h5">{user?.full_name}</Typography>
              <Typography color="text.secondary">{user?.email}</Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Chip size="small" label={user?.department || "No department"} />
                <Chip size="small" color="success" label="Verified" />
              </Stack>
            </Stack>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" gutterBottom>Payment</Typography>
            <Stack direction="row" justifyContent="space-between">
              <Typography color="text.secondary">Entry fee</Typography>
              <Typography>Rs. {payment?.amount ?? 1000}</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between">
              <Typography color="text.secondary">Status</Typography>
              <Chip size="small" color={payment?.status === "verified" ? "success" : "warning"} label={payment?.status || "—"} />
            </Stack>
          </GlassCard>
        </Grid>

        <Grid item xs={12} md={8}>
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={4}><StatCard icon={<EmojiEventsIcon />} accent={BRAND.amber} label="Points" value={dash?.total_points ?? 0} /></Grid>
            <Grid item xs={12} sm={4}><StatCard icon={<PercentIcon />} accent={BRAND.pitch} label="Accuracy" value={`${dash?.accuracy ?? 0}%`} /></Grid>
            <Grid item xs={12} sm={4}><StatCard icon={<ChecklistIcon />} accent={BRAND.azure} label="Predictions made" value={preds?.length ?? 0} /></Grid>
            <Grid item xs={12}>
              <GlassCard>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                  <BadgeIcon color="secondary" /><Typography variant="h6">Achievements</Typography>
                </Stack>
                <Stack direction="row" flexWrap="wrap" gap={1.25}>
                  {earned.map((b) => (
                    <Chip key={b.label} label={b.label} color={b.got ? "secondary" : "default"}
                          variant={b.got ? "filled" : "outlined"} sx={{ opacity: b.got ? 1 : 0.5 }} />
                  ))}
                </Stack>
              </GlassCard>
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </Box>
  );
}
