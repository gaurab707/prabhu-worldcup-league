import { Avatar, Box, Paper, Skeleton, Stack, Typography, useTheme } from "@mui/material";
import type { ReactNode } from "react";
import { glassSx } from "../theme/theme";
import type { Team } from "../api/types";

/** A glassmorphism surface used across the app. */
export function GlassCard({ children, sx, ...rest }: any) {
  const theme = useTheme();
  return (
    <Paper elevation={0} sx={{ ...glassSx(theme), p: 2.5, ...sx }} {...rest}>
      {children}
    </Paper>
  );
}

/** Country flag avatar with graceful fallback to the team code. */
export function TeamFlag({ team, size = 34 }: { team: Team; size?: number }) {
  return (
    <Avatar
      src={team.flag_url || undefined}
      alt={team.name}
      variant="rounded"
      sx={{ width: size, height: size, fontSize: size * 0.32, fontWeight: 700, bgcolor: "rgba(255,255,255,0.08)" }}
    >
      {team.short_code || team.name.slice(0, 3).toUpperCase()}
    </Avatar>
  );
}

/** KPI card with icon, value, label and optional accent colour. */
export function StatCard({
  icon, label, value, accent, sub,
}: {
  icon: ReactNode; label: string; value: ReactNode; accent?: string; sub?: string;
}) {
  const theme = useTheme();
  return (
    <Paper elevation={0} sx={{ ...glassSx(theme), p: 2.25, height: "100%" }}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Box
          sx={{
            width: 44, height: 44, borderRadius: 3, display: "grid", placeItems: "center",
            color: accent || theme.palette.primary.main,
            background: `${accent || theme.palette.primary.main}22`,
          }}
        >
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h5" sx={{ lineHeight: 1.1 }}>{value}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap>{label}</Typography>
          {sub && <Typography variant="caption" color="text.secondary" display="block">{sub}</Typography>}
        </Box>
      </Stack>
    </Paper>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between"
           alignItems={{ xs: "flex-start", sm: "center" }} spacing={1.5} sx={{ mb: 3 }}>
      <Box>
        <Typography variant="h4">{title}</Typography>
        {subtitle && <Typography color="text.secondary" sx={{ mt: 0.5 }}>{subtitle}</Typography>}
      </Box>
      {action}
    </Stack>
  );
}

export function CardSkeleton({ height = 120 }: { height?: number }) {
  return <Skeleton variant="rounded" height={height} sx={{ borderRadius: 4 }} />;
}
