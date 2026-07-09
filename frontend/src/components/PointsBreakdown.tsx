import { useState } from "react";
import {
  Accordion, AccordionDetails, AccordionSummary, Box, Chip, Stack, Table, TableBody,
  TableCell, TableHead, TableRow, Typography, useTheme, CircularProgress,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import { useQuery } from "@tanstack/react-query";
import { winnerApi } from "../api/client";
import type { BreakdownMatch } from "../api/types";
import { TeamFlag } from "./ui";
import { clearTableSx, BRAND } from "../theme/theme";

function Fixture({ m }: { m: BreakdownMatch }) {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center">
      <TeamFlag team={{ id: 0, name: m.home_team, flag_url: m.home_flag, short_code: null }} size={18} />
      <Typography variant="body2" noWrap>{m.home_team}</Typography>
      <Typography variant="caption" color="text.secondary">v</Typography>
      <TeamFlag team={{ id: 0, name: m.away_team, flag_url: m.away_flag, short_code: null }} size={18} />
      <Typography variant="body2" noWrap>{m.away_team}</Typography>
    </Stack>
  );
}

/** Small W / S / P / ×mult chips explaining where a match's points came from. */
function Components({ m }: { m: BreakdownMatch }) {
  const bits: string[] = [];
  if (m.outcome_points) bits.push(`Result +${m.outcome_points}`);
  if (m.closeness_points) bits.push(`Closeness +${m.closeness_points}`);
  if (m.penalty_points) bits.push(`Penalty +${m.penalty_points}`);
  if (m.difficulty_multiplier && m.difficulty_multiplier !== 1) bits.push(`Underdog ×${m.difficulty_multiplier}`);
  return (
    <Typography variant="caption" color="text.secondary">
      {bits.length ? bits.join("  ·  ") : "No points"}
    </Typography>
  );
}

/**
 * Expandable "How they earned it" panel for a player. Fetches the breakdown
 * only when opened. Used on both the admin Winners screen and the public
 * Winners podium (after reveal).
 */
export function PlayerBreakdown({
  userId, defaultExpanded = false,
}: { userId: number; defaultExpanded?: boolean }) {
  const theme = useTheme();
  const [open, setOpen] = useState(defaultExpanded);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["breakdown", userId],
    queryFn: () => winnerApi.breakdown(userId),
    enabled: open,
  });

  return (
    <Accordion expanded={open} onChange={(_, v) => setOpen(v)} disableGutters
      sx={{ background: "transparent", boxShadow: "none", "&:before": { display: "none" },
            border: `1px solid ${theme.palette.divider}`, borderRadius: "10px !important", mt: 1 }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Stack direction="row" spacing={1} alignItems="center">
          <ReceiptLongIcon fontSize="small" color="secondary" />
          <Typography fontWeight={600}>How these points were earned</Typography>
        </Stack>
      </AccordionSummary>
      <AccordionDetails>
        {isLoading && <Stack alignItems="center" sx={{ py: 3 }}><CircularProgress size={22} /></Stack>}
        {isError && <Typography color="text.secondary" variant="body2">Breakdown isn&rsquo;t available.</Typography>}
        {data && (
          <Box>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
              <Chip size="small" color="secondary" label={`Total ${data.total_points} pts`} sx={{ fontWeight: 700 }} />
              <Chip size="small" variant="outlined" label={`Matches ${data.match_points}`} />
              {data.champion_points > 0 && (
                <Chip size="small" variant="outlined" color="secondary"
                  icon={<EmojiEventsIcon sx={{ fontSize: 15 }} />} label={`Champion +${data.champion_points}`} />
              )}
            </Stack>

            {data.matches.length > 0 ? (
              <Box sx={{ overflowX: "auto" }}>
                <Table size="small" sx={{ minWidth: 560, ...clearTableSx(theme) }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Match</TableCell>
                      <TableCell align="center">Your pick</TableCell>
                      <TableCell align="center">Result</TableCell>
                      <TableCell>Where the points came from</TableCell>
                      <TableCell align="right">Points</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.matches.map((m) => (
                      <TableRow key={m.match_id}>
                        <TableCell><Fixture m={m} /></TableCell>
                        <TableCell align="center">
                          {m.pred_home}–{m.pred_away}
                          {m.pred_home_pen != null && m.pred_away_pen != null && (
                            <Typography variant="caption" color="text.secondary"> ({m.pred_home_pen}-{m.pred_away_pen}p)</Typography>
                          )}
                        </TableCell>
                        <TableCell align="center">
                          {m.actual_home}–{m.actual_away}
                          {m.is_penalty && m.actual_home_pen != null && (
                            <Typography variant="caption" color="text.secondary"> ({m.actual_home_pen}-{m.actual_away_pen}p)</Typography>
                          )}
                        </TableCell>
                        <TableCell><Components m={m} /></TableCell>
                        <TableCell align="right">
                          <Typography fontWeight={700} color={m.points_awarded > 0 ? "secondary.main" : "text.secondary"}>
                            {m.points_awarded}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">No scored match predictions yet.</Typography>
            )}

            {data.champion && (
              <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mt: 1.5, p: 1.25, borderRadius: 2,
                border: `1px solid ${theme.palette.divider}`,
                borderLeft: `4px solid ${data.champion.is_correct ? BRAND.pitch : theme.palette.divider}` }}>
                <EmojiEventsIcon fontSize="small" color={data.champion.is_correct ? "success" : "disabled"} />
                <TeamFlag team={{ id: 0, name: data.champion.team_name, flag_url: data.champion.team_flag, short_code: null }} size={20} />
                <Typography variant="body2" sx={{ flex: 1 }}>
                  World Cup champion pick: <b>{data.champion.team_name}</b>{" "}
                  {data.champion.is_correct ? "— correct!" : "— not correct"}
                </Typography>
                {data.champion.points_awarded > 0 && (
                  <Chip size="small" color="success" label={`+${data.champion.points_awarded}`} />
                )}
              </Stack>
            )}
          </Box>
        )}
      </AccordionDetails>
    </Accordion>
  );
}
