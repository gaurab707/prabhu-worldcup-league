import { useEffect } from "react";
import { Box, Chip, Grid, Stack, Typography, useTheme, alpha } from "@mui/material";
import { keyframes } from "@emotion/react";
import { useQuery } from "@tanstack/react-query";
import confetti from "canvas-confetti";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import { winnerApi, settingsApi } from "../api/client";
import { GlassCard, PageHeader } from "../components/ui";
import { BRAND } from "../theme/theme";

const PODIUM = [
  { medal: "🥇", color: "#FFD54F", order: 2, height: 210 },
  { medal: "🥈", color: "#CFD8DC", order: 1, height: 170 },
  { medal: "🥉", color: "#D98A56", order: 3, height: 140 },
];

// Podium bars grow up from the floor; cards fade in above them.
const rise = keyframes`
  from { transform: scaleY(0.05); opacity: 0; }
  60%  { opacity: 1; }
  to   { transform: scaleY(1); opacity: 1; }
`;
const popIn = keyframes`
  from { transform: translateY(16px) scale(0.9); opacity: 0; }
  to   { transform: none; opacity: 1; }
`;

export default function WinnerPage() {
  const theme = useTheme();
  const { data: winners } = useQuery({ queryKey: ["winners"], queryFn: winnerApi.list });
  const { data: settings } = useQuery({ queryKey: ["public-settings"], queryFn: settingsApi.publicSettings });

  useEffect(() => {
    if (winners?.length) {
      const end = Date.now() + 1200;
      const frame = () => {
        confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors: [BRAND.amber, BRAND.azure, BRAND.pitch] });
        confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors: [BRAND.amber, BRAND.azure, BRAND.pitch] });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
    }
  }, [winners?.length]);

  if (!winners?.length) {
    return (
      <Box>
        <PageHeader title="Winners" subtitle="The podium will appear here once results are published." />
        <GlassCard sx={{ textAlign: "center", py: 8 }}>
          <EmojiEventsIcon sx={{ fontSize: 72, color: "text.secondary", opacity: 0.4 }} />
          <Typography variant="h6" sx={{ mt: 2 }}>No winners announced yet</Typography>
          <Typography color="text.secondary">Keep predicting — the champions are still being decided.</Typography>
        </GlassCard>
      </Box>
    );
  }

  const byPos = (p: number) => winners.find((w) => w.position === p);

  return (
    <Box>
      <Box sx={{ textAlign: "center", mb: 4, py: 4, borderRadius: 4,
        background: `linear-gradient(135deg, ${alpha(BRAND.amber, 0.18)}, ${alpha(BRAND.azure, 0.12)})`,
        border: `1px solid ${theme.palette.divider}` }}>
        <Typography variant="h3" sx={{ fontWeight: 800 }}>🏆 {settings?.winner_banner_text || "Champions!"}</Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>Prabhu Capital World Cup Prediction League</Typography>
      </Box>

      <Grid container spacing={3} alignItems="flex-end" justifyContent="center" sx={{ mb: 4 }}>
        {PODIUM.map((p, i) => {
          const w = byPos(i + 1);
          if (!w) return null;
          return (
            <Grid item xs={12} sm={4} key={i} sx={{ order: { sm: p.order } }}>
              <Stack alignItems="center" spacing={1.5}>
                <Stack alignItems="center" spacing={1.5}
                  sx={{ animation: `${popIn} 0.6s ease both`, animationDelay: `${0.15 * (3 - i)}s` }}>
                  <Typography sx={{ fontSize: 44 }}>{p.medal}</Typography>
                  <Typography variant="h6" textAlign="center">{w.name}</Typography>
                  <Chip label={`${w.points} pts`} color="secondary" />
                  {w.prize && <Chip variant="outlined" label={w.prize + (w.prize_amount ? ` · Rs. ${w.prize_amount}` : "")} />}
                </Stack>
                <Box sx={{ width: "100%", height: p.height, borderRadius: "12px 12px 0 0",
                  background: `linear-gradient(180deg, ${alpha(p.color, 0.85)}, ${alpha(p.color, 0.35)})`,
                  display: "grid", placeItems: "center", boxShadow: `0 -10px 40px ${alpha(p.color, 0.35)}`,
                  transformOrigin: "bottom",
                  animation: `${rise} 0.7s cubic-bezier(0.22, 1, 0.36, 1) both`,
                  animationDelay: `${0.15 * (3 - i)}s` }}>
                  <Typography variant="h2" sx={{ fontWeight: 900, color: "#0B1220" }}>{i + 1}</Typography>
                </Box>
                {w.notes && <Typography variant="caption" color="text.secondary" textAlign="center">{w.notes}</Typography>}
              </Stack>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}
