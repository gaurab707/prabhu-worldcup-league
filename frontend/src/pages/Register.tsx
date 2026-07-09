import { useRef, useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import {
  Alert, Box, Button, Grid, Link, Paper, Stack, Step, StepLabel, Stepper,
  TextField, Typography, useTheme,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import { authApi, errMsg, settingsApi, assetUrl } from "../api/client";
import { GlassCard } from "../components/ui";

const steps = ["Your details", "Pay & upload", "Done"];

export default function Register() {
  const theme = useTheme();
  const nav = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const fileRef = useRef<HTMLInputElement>(null);

  const [active, setActive] = useState(0);
  const [form, setForm] = useState({ email: "", full_name: "", department: "", password: "", confirm_password: "" });
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const { data: settings } = useQuery({ queryKey: ["public-settings"], queryFn: settingsApi.publicSettings });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const detailsValid =
    form.email.includes("@") && form.full_name.length >= 2 &&
    form.password.length >= 1 && form.password === form.confirm_password;

  const submit = async () => {
    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => v && fd.append(k, v));
      if (file) fd.append("payment_screenshot", file);
      await authApi.register(fd);
      setActive(2);
    } catch (err) {
      enqueueSnackbar(errMsg(err, "Registration failed"), { variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", p: { xs: 2, sm: 4 } }}>
      <GlassCard sx={{ p: { xs: 3, sm: 4.5 }, width: "100%", maxWidth: 720 }}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 3 }}>
          <Box sx={{ bgcolor: "#fff", borderRadius: 2, p: 0.75, display: "flex" }}>
            <img src={assetUrl(settings?.company_logo_url) || "https://www.prabhucapital.com/brand-logo.png"}
                 alt="Prabhu Capital" height={26} />
          </Box>
          <Typography variant="h5">Join the Prediction League</Typography>
        </Stack>

        <Stepper activeStep={active} sx={{ mb: 4 }}>
          {steps.map((s) => <Step key={s}><StepLabel>{s}</StepLabel></Step>)}
        </Stepper>

        {active === 0 && (
          <Stack spacing={2}>
            <TextField label="Office email" type="email" required value={form.email} onChange={set("email")} />
            <TextField label="Full name" required value={form.full_name} onChange={set("full_name")}
                       helperText="Use the exact name you'll write in the payment remarks." />
            <TextField label="Department (optional)" value={form.department} onChange={set("department")} />
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField label="Password" type="password" fullWidth required value={form.password} onChange={set("password")} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label="Confirm password" type="password" fullWidth required
                           error={!!form.confirm_password && form.confirm_password !== form.password}
                           helperText={form.confirm_password && form.confirm_password !== form.password ? "Passwords do not match" : " "}
                           value={form.confirm_password} onChange={set("confirm_password")} />
              </Grid>
            </Grid>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Link component={RouterLink} to="/login">Already have an account?</Link>
              <Button variant="contained" disabled={!detailsValid} onClick={() => setActive(1)}>Continue</Button>
            </Box>
          </Stack>
        )}

        {active === 1 && (
          <Grid container spacing={3}>
            <Grid item xs={12} sm={5}>
              <Paper elevation={0} sx={{ p: 2, textAlign: "center", border: `1px solid ${theme.palette.divider}` }}>
                {settings?.payment_qr_url ? (
                  <Box component="img" src={assetUrl(settings.payment_qr_url)} alt="Payment QR"
                       sx={{ width: "100%", borderRadius: 2, background: "#fff", p: 1 }} />
                ) : (
                  <Box sx={{ py: 6, color: "text.secondary" }}>
                    <QrCode2Icon sx={{ fontSize: 64, opacity: 0.4 }} />
                    <Typography variant="body2">QR not uploaded yet. Contact the admin.</Typography>
                  </Box>
                )}
              </Paper>
            </Grid>
            <Grid item xs={12} sm={7}>
              <Alert severity="info" sx={{ mb: 2 }}>
                {settings?.payment_message ||
                  "Please pay Rs. 1000 and write your Full Name in the payment Remarks for verification."}
              </Alert>
              <input ref={fileRef} type="file" accept="image/*" hidden
                     onChange={(e) => setFile(e.target.files?.[0] || null)} />
              <Button fullWidth variant="outlined" startIcon={<CloudUploadIcon />}
                      onClick={() => fileRef.current?.click()} sx={{ mb: 1.5, py: 1.5 }}>
                {file ? "Change screenshot" : "Upload payment screenshot"}
              </Button>
              {file && (
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2, color: "success.main" }}>
                  <CheckCircleIcon fontSize="small" /><Typography variant="body2" noWrap>{file.name}</Typography>
                </Stack>
              )}
              <Stack direction="row" justifyContent="space-between" sx={{ mt: 2 }}>
                <Button onClick={() => setActive(0)}>Back</Button>
                <Button variant="contained" disabled={loading} onClick={submit}>
                  {loading ? "Submitting…" : "Submit registration"}
                </Button>
              </Stack>
            </Grid>
          </Grid>
        )}

        {active === 2 && (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <CheckCircleIcon color="success" sx={{ fontSize: 68, mb: 2 }} />
            <Typography variant="h5" gutterBottom>Registration received</Typography>
            <Typography color="text.secondary" sx={{ maxWidth: 460, mx: "auto", mb: 3 }}>
              Your account is <b>pending payment verification</b>. Once an administrator confirms your Rs. 1000 entry,
              you'll be able to sign in and start predicting.
            </Typography>
            <Button variant="contained" onClick={() => nav("/login")}>Go to sign in</Button>
          </Box>
        )}
      </GlassCard>
    </Box>
  );
}
