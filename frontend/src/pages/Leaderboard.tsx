import { useState } from "react";
import {
  Avatar, Box, Chip, InputAdornment, Stack, Table, TableBody, TableCell,
  TableHead, TableRow, TextField, ToggleButton, ToggleButtonGroup, Typography, useTheme,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import SearchIcon from "@mui/icons-material/Search";
import { leaderboardApi } from "../api/client";
import { GlassCard, PageHeader } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import { BRAND } from "../theme/theme";

const MEDAL = ["#FFD54F", "#B0BEC5", "#D98A56"];

export default function Leaderboard() {
  const theme = useTheme();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [top, setTop] = useState<number | undefined>(undefined);
  const { data } = useQuery({
    queryKey: ["leaderboard", search, top],
    queryFn: () => leaderboardApi.get({ search: search || undefined, limit: top }),
  });

  return (
    <Box>
      <PageHeader title="Leaderboard" subtitle="Ranked by total points earned across all scored matches." />
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="space-between" sx={{ mb: 2.5 }}>
        <TextField placeholder="Search a colleague…" value={search} onChange={(e) => setSearch(e.target.value)}
          sx={{ maxWidth: 320 }} InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />
        <ToggleButtonGroup exclusive size="small" value={top} onChange={(_, v) => setTop(v)}>
          <ToggleButton value={undefined as any}>All</ToggleButton>
          <ToggleButton value={10}>Top 10</ToggleButton>
          <ToggleButton value={20}>Top 20</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      <GlassCard sx={{ p: 0, overflow: "hidden" }}>
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 720 }}>
            <TableHead>
              <TableRow sx={{ "& th": { fontWeight: 700, color: "text.secondary", borderColor: theme.palette.divider } }}>
                <TableCell sx={{ pl: 3 }}>#</TableCell>
                <TableCell>Player</TableCell>
                <TableCell>Dept</TableCell>
                <TableCell align="right">Points</TableCell>
                <TableCell align="right">Played</TableCell>
                <TableCell align="right">Winner %</TableCell>
                <TableCell align="right">Exact %</TableCell>
                <TableCell align="right">Pen %</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(data || []).map((r) => {
                const me = r.user_id === user?.id;
                return (
                  <TableRow key={r.user_id}
                    sx={{ background: me ? `${BRAND.azure}14` : "transparent",
                          "& td": { borderColor: theme.palette.divider } }}>
                    <TableCell sx={{ pl: 3 }}>
                      <Avatar sx={{ width: 26, height: 26, fontSize: 13, fontWeight: 800,
                        bgcolor: r.rank <= 3 ? MEDAL[r.rank - 1] : "transparent",
                        color: r.rank <= 3 ? "#0B1220" : "text.secondary",
                        border: r.rank <= 3 ? "none" : `1px solid ${theme.palette.divider}` }}>
                        {r.rank}
                      </Avatar>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1.25} alignItems="center">
                        <Avatar sx={{ width: 30, height: 30, fontSize: 14, bgcolor: "primary.main" }}>{r.name[0]}</Avatar>
                        <Typography fontWeight={me ? 800 : 600}>{r.name}{me && <Chip size="small" label="You" sx={{ ml: 1, height: 18 }} />}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell><Typography variant="body2" color="text.secondary">{r.department || "—"}</Typography></TableCell>
                    <TableCell align="right"><Typography fontWeight={800} color="secondary.main">{r.points}</Typography></TableCell>
                    <TableCell align="right">{r.played}</TableCell>
                    <TableCell align="right">{r.winner_pct}%</TableCell>
                    <TableCell align="right">{r.score_pct}%</TableCell>
                    <TableCell align="right">{r.penalty_pct}%</TableCell>
                  </TableRow>
                );
              })}
              {!data?.length && (
                <TableRow><TableCell colSpan={8} align="center" sx={{ py: 5, color: "text.secondary" }}>
                  No players match your search.
                </TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Box>
      </GlassCard>
    </Box>
  );
}
