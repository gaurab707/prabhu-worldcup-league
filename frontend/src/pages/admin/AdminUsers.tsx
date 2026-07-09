import { useState } from "react";
import {
  Avatar, Box, Chip, InputAdornment, MenuItem, Select, Stack, Table, TableBody,
  TableCell, TableHead, TableRow, TextField, Typography, useTheme,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import SearchIcon from "@mui/icons-material/Search";
import { userApi, errMsg } from "../../api/client";
import type { User } from "../../api/types";
import { GlassCard, PageHeader } from "../../components/ui";

const STATUS_COLORS: any = { active: "success", pending: "warning", rejected: "error", disabled: "default" };
const PAY_COLORS: any = { verified: "success", pending: "warning", rejected: "error" };

export default function AdminUsers() {
  const theme = useTheme();
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [search, setSearch] = useState("");
  const { data: users } = useQuery({ queryKey: ["admin-users"], queryFn: userApi.list });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => userApi.setStatus(id, status),
    onSuccess: () => { enqueueSnackbar("User updated", { variant: "success" }); qc.invalidateQueries(); },
    onError: (e) => enqueueSnackbar(errMsg(e), { variant: "error" }),
  });

  const filtered = (users || []).filter((u) =>
    !search || u.full_name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));

  return (
    <Box>
      <PageHeader title="Users" subtitle="Every registered participant, their payment state, and account controls." />
      <TextField placeholder="Search name or email…" value={search} onChange={(e) => setSearch(e.target.value)}
        sx={{ maxWidth: 340, mb: 2.5 }}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />

      <GlassCard sx={{ p: 0, overflow: "hidden" }}>
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 820 }}>
            <TableHead>
              <TableRow sx={{ "& th": { fontWeight: 700, color: "text.secondary", borderColor: theme.palette.divider } }}>
                <TableCell sx={{ pl: 3 }}>Name</TableCell>
                <TableCell>Department</TableCell>
                <TableCell>Role</TableCell>
                <TableCell align="center">Payment</TableCell>
                <TableCell align="right">Points</TableCell>
                <TableCell align="right" sx={{ pr: 3 }}>Account status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((u: User) => (
                <TableRow key={u.id} sx={{ "& td": { borderColor: theme.palette.divider } }}>
                  <TableCell sx={{ pl: 3 }}>
                    <Stack direction="row" spacing={1.25} alignItems="center">
                      <Avatar sx={{ width: 32, height: 32, fontSize: 14, bgcolor: "primary.main" }}>{u.full_name[0]}</Avatar>
                      <Box>
                        <Typography fontWeight={600}>{u.full_name}</Typography>
                        <Typography variant="caption" color="text.secondary">{u.email}</Typography>
                      </Box>
                    </Stack>
                  </TableCell>
                  <TableCell><Typography variant="body2" color="text.secondary">{u.department || "—"}</Typography></TableCell>
                  <TableCell><Chip size="small" variant="outlined" color={u.role === "admin" ? "secondary" : "default"} label={u.role} /></TableCell>
                  <TableCell align="center"><Chip size="small" color={PAY_COLORS[u.payment_status || ""] || "default"} label={u.payment_status || "—"} /></TableCell>
                  <TableCell align="right"><Typography fontWeight={700}>{u.total_points}</Typography></TableCell>
                  <TableCell align="right" sx={{ pr: 3 }}>
                    {u.role === "admin" ? (
                      <Chip size="small" color="secondary" label="Administrator" />
                    ) : (
                      <Select size="small" value={u.status} sx={{ minWidth: 130 }}
                        onChange={(e) => setStatus.mutate({ id: u.id, status: e.target.value })}>
                        {["active", "pending", "disabled", "rejected"].map((s) => (
                          <MenuItem key={s} value={s}>
                            <Chip size="small" color={STATUS_COLORS[s]} label={s} sx={{ pointerEvents: "none" }} />
                          </MenuItem>
                        ))}
                      </Select>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!filtered.length && (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 5, color: "text.secondary" }}>No users found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Box>
      </GlassCard>
    </Box>
  );
}
