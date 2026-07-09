import { useState } from "react";
import {
  Avatar, Box, Button, Chip, Dialog, DialogContent, DialogTitle, Grid, IconButton,
  Stack, Tab, Tabs, Typography, useTheme,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import dayjs from "dayjs";
import { paymentApi, userApi, assetUrl, errMsg } from "../../api/client";
import type { Payment, User } from "../../api/types";
import { GlassCard, PageHeader } from "../../components/ui";

const STATUS = ["pending", "verified", "rejected"];

export default function AdminPayments() {
  const theme = useTheme();
  const qc = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [tab, setTab] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);

  const status = STATUS[tab];
  const { data: payments } = useQuery({ queryKey: ["admin-payments", status], queryFn: () => paymentApi.list(status) });
  const { data: users } = useQuery({ queryKey: ["admin-users"], queryFn: userApi.list });
  const userMap = new Map((users || []).map((u: User) => [u.id, u]));

  const review = useMutation({
    mutationFn: ({ id, approve }: { id: number; approve: boolean }) => paymentApi.review(id, approve),
    onSuccess: (_, v) => { enqueueSnackbar(v.approve ? "Payment verified — user activated" : "Payment rejected", { variant: v.approve ? "success" : "warning" }); qc.invalidateQueries(); },
    onError: (e) => enqueueSnackbar(errMsg(e), { variant: "error" }),
  });

  return (
    <Box>
      <PageHeader title="Payments" subtitle="Verify entry-fee screenshots. Approving a pending payment activates that user's account." />
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="Pending" /><Tab label="Verified" /><Tab label="Rejected" />
      </Tabs>

      <Grid container spacing={2.5}>
        {(payments || []).map((p: Payment) => {
          const u = userMap.get(p.user_id);
          return (
            <Grid item xs={12} md={6} lg={4} key={p.id}>
              <GlassCard>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
                  <Avatar sx={{ bgcolor: "primary.main" }}>{u?.full_name?.[0] || "?"}</Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography fontWeight={700} noWrap>{u?.full_name || `User #${p.user_id}`}</Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>{u?.email}</Typography>
                  </Box>
                  <Chip size="small" color={p.status === "verified" ? "success" : p.status === "rejected" ? "error" : "warning"} label={p.status} />
                </Stack>

                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                  <Typography variant="body2" color="text.secondary">Amount</Typography>
                  <Typography variant="body2" fontWeight={700}>Rs. {p.amount}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                  <Typography variant="body2" color="text.secondary">Remarks</Typography>
                  <Typography variant="body2">{p.remarks || "—"}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 1.5 }}>
                  <Typography variant="body2" color="text.secondary">Submitted</Typography>
                  <Typography variant="body2">{dayjs(p.created_at).format("MMM D, HH:mm")}</Typography>
                </Stack>

                <Box sx={{ position: "relative", borderRadius: 2, overflow: "hidden", border: `1px solid ${theme.palette.divider}`, mb: 1.5, minHeight: 120, display: "grid", placeItems: "center", background: theme.palette.mode === "dark" ? "#0B1220" : "#F1F5F9" }}>
                  {p.screenshot_path ? (
                    <>
                      <Box component="img" src={assetUrl(p.screenshot_path)} alt="payment"
                           sx={{ width: "100%", maxHeight: 200, objectFit: "contain", cursor: "pointer" }}
                           onClick={() => setPreview(assetUrl(p.screenshot_path) || null)} />
                      <IconButton size="small" onClick={() => setPreview(assetUrl(p.screenshot_path) || null)}
                        sx={{ position: "absolute", top: 6, right: 6, bgcolor: "rgba(0,0,0,0.5)", color: "#fff" }}>
                        <ZoomInIcon fontSize="small" />
                      </IconButton>
                    </>
                  ) : (
                    <Stack alignItems="center" sx={{ color: "text.secondary", py: 3 }}>
                      <ReceiptLongIcon sx={{ fontSize: 40, opacity: 0.4 }} />
                      <Typography variant="caption">No screenshot uploaded</Typography>
                    </Stack>
                  )}
                </Box>

                {p.status === "pending" && (
                  <Stack direction="row" spacing={1}>
                    <Button fullWidth variant="contained" color="success" startIcon={<CheckIcon />}
                            disabled={review.isPending} onClick={() => review.mutate({ id: p.id, approve: true })}>
                      Verify
                    </Button>
                    <Button fullWidth variant="outlined" color="error" startIcon={<CloseIcon />}
                            disabled={review.isPending} onClick={() => review.mutate({ id: p.id, approve: false })}>
                      Reject
                    </Button>
                  </Stack>
                )}
              </GlassCard>
            </Grid>
          );
        })}
        {!payments?.length && (
          <Grid item xs={12}><GlassCard><Typography color="text.secondary" textAlign="center" sx={{ py: 3 }}>No {status} payments.</Typography></GlassCard></Grid>
        )}
      </Grid>

      <Dialog open={!!preview} onClose={() => setPreview(null)} maxWidth="md">
        <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          Payment screenshot
          <IconButton onClick={() => setPreview(null)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent>
          {preview && <Box component="img" src={preview} alt="payment full" sx={{ width: "100%", borderRadius: 2 }} />}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
