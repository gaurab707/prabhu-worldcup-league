import { useState } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import {
  Box, Button, Grid, Link, Stack, TextField, Typography, useTheme, alpha,
} from "@mui/material";
import { useSnackbar } from "notistack";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import { authApi, errMsg } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { GlassCard } from "../components/ui";
import { BRAND } from "../theme/theme";

export default function Login() {
  const theme = useTheme();
  const nav = useNavigate();
  const { login } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authApi.login(email, password);
      login(res.access_token, res.user);
      enqueueSnackbar(`Welcome back, ${res.user.full_name.split(" ")[0]}!`, { variant: "success" });
      nav(res.user.role === "admin" ? "/admin" : "/");
    } catch (err) {
      enqueueSnackbar(errMsg(err, "Login failed"), { variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Grid container sx={{ minHeight: "100vh" }}>
      {/* Brand panel */}
      <Grid item xs={12} md={6}
        sx={{
          display: { xs: "none", md: "flex" }, flexDirection: "column", justifyContent: "space-between",
          p: 6, color: "#fff", position: "relative", overflow: "hidden",
          background: `linear-gradient(150deg, ${BRAND.azureDeep} 0%, #0A1B3D 55%, #06122B 100%)`,
        }}
      >
        <Box sx={{ position: "absolute", inset: 0, opacity: 0.25,
          background: `radial-gradient(600px 300px at 80% 10%, ${alpha(BRAND.amber, 0.7)}, transparent 60%),
                       radial-gradient(500px 400px at 10% 90%, ${alpha(BRAND.pitch, 0.6)}, transparent 60%)` }} />
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ position: "relative" }}>
          <Box sx={{ bgcolor: "#fff", borderRadius: 2, p: 0.75, display: "flex" }}>
            <img src="https://www.prabhucapital.com/brand-logo.png" alt="Prabhu Capital" height={30} />
          </Box>
          <Typography sx={{ fontFamily: "Sora", fontWeight: 800 }}>Prabhu Capital</Typography>
        </Stack>
        <Box sx={{ position: "relative" }}>
          <SportsSoccerIcon sx={{ fontSize: 46, mb: 2, color: BRAND.amberBright }} />
          <Typography variant="h2" sx={{ fontWeight: 800, lineHeight: 1.05, maxWidth: 460 }}>
            The office World Cup, decided by your calls.
          </Typography>
          <Typography sx={{ mt: 2, maxWidth: 420, opacity: 0.85 }}>
            Predict every fixture, earn points on a fair weighted scoring system, and climb the company leaderboard.
          </Typography>
        </Box>
        <Typography variant="caption" sx={{ position: "relative", opacity: 0.6 }}>
          Internal use · Prabhu Capital Prediction League
        </Typography>
      </Grid>

      {/* Form */}
      <Grid item xs={12} md={6} sx={{ display: "grid", placeItems: "center", p: { xs: 3, sm: 6 } }}>
        <GlassCard sx={{ p: { xs: 3, sm: 4.5 }, width: "100%", maxWidth: 420 }}>
          <Typography variant="h4" gutterBottom>Sign in</Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Use your Prabhu Capital office email.
          </Typography>
          <Box component="form" onSubmit={submit}>
            <Stack spacing={2}>
              <TextField label="Office email" type="email" fullWidth required value={email}
                         size="medium" onChange={(e) => setEmail(e.target.value)} />
              <TextField label="Password" type="password" fullWidth required value={password}
                         size="medium" onChange={(e) => setPassword(e.target.value)} />
              <Button type="submit" variant="contained" size="large" disabled={loading}>
                {loading ? "Signing in…" : "Sign in"}
              </Button>
            </Stack>
          </Box>
          <Typography sx={{ mt: 3 }} color="text.secondary" variant="body2">
            New to the league?{" "}
            <Link component={RouterLink} to="/register" fontWeight={700}>Create an account</Link>
          </Typography>
        </GlassCard>
      </Grid>
    </Grid>
  );
}
