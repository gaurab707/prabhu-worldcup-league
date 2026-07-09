import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  AppBar, Avatar, Box, Divider, Drawer, IconButton, List, ListItemButton,
  ListItemIcon, ListItemText, Menu, MenuItem, Stack, Toolbar, Tooltip,
  Typography, useMediaQuery, useTheme,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import DashboardIcon from "@mui/icons-material/SpaceDashboard";
import SportsSoccerIcon from "@mui/icons-material/SportsSoccer";
import LeaderboardIcon from "@mui/icons-material/EmojiEvents";
import PersonIcon from "@mui/icons-material/AccountCircle";
import MenuIcon from "@mui/icons-material/Menu";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LogoutIcon from "@mui/icons-material/Logout";
import ShieldIcon from "@mui/icons-material/AdminPanelSettings";
import GroupIcon from "@mui/icons-material/Group";
import PaymentsIcon from "@mui/icons-material/ReceiptLong";
import StarIcon from "@mui/icons-material/WorkspacePremium";
import PublicIcon from "@mui/icons-material/Public";
import { useAuth } from "../context/AuthContext";
import { useColorMode } from "../context/ColorModeContext";
import { settingsApi, assetUrl } from "../api/client";
import { BRAND } from "../theme/theme";

const DRAWER = 264;

const staffNav = [
  { to: "/", label: "Dashboard", icon: <DashboardIcon /> },
  { to: "/predictions", label: "Predictions", icon: <SportsSoccerIcon /> },
  { to: "/champion", label: "World Cup Winner", icon: <PublicIcon /> },
  { to: "/leaderboard", label: "Leaderboard", icon: <LeaderboardIcon /> },
  { to: "/winners", label: "Winners", icon: <StarIcon /> },
  { to: "/profile", label: "My Profile", icon: <PersonIcon /> },
];
const adminNav = [
  { to: "/admin", label: "Admin Overview", icon: <ShieldIcon /> },
  { to: "/admin/games", label: "Manage Games", icon: <SportsSoccerIcon /> },
  { to: "/admin/users", label: "Users", icon: <GroupIcon /> },
  { to: "/admin/payments", label: "Payments", icon: <PaymentsIcon /> },
  { to: "/admin/champion", label: "Champion Prize", icon: <PublicIcon /> },
  { to: "/admin/winners", label: "Winners & Prizes", icon: <StarIcon /> },
];

export default function AppLayout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const { user, isAdmin, logout } = useAuth();
  const { mode, toggle } = useColorMode();
  const nav = useNavigate();
  const loc = useLocation();

  const { data: settings } = useQuery({ queryKey: ["public-settings"], queryFn: settingsApi.publicSettings });
  const logo = assetUrl(settings?.company_logo_url) || "https://www.prabhucapital.com/brand-logo.png";

  const go = (to: string) => { nav(to); if (isMobile) setOpen(false); };

  const NavList = ({ items }: { items: typeof staffNav }) => (
    <List sx={{ px: 1.5 }}>
      {items.map((it) => {
        const active = loc.pathname === it.to;
        return (
          <ListItemButton
            key={it.to}
            onClick={() => go(it.to)}
            sx={{
              borderRadius: 3, mb: 0.5, py: 1,
              color: active ? "primary.main" : "text.secondary",
              background: active ? `${BRAND.azure}1f` : "transparent",
              "&:hover": { background: `${BRAND.azure}14` },
            }}
          >
            <ListItemIcon sx={{ minWidth: 40, color: "inherit" }}>{it.icon}</ListItemIcon>
            <ListItemText primaryTypographyProps={{ fontWeight: active ? 700 : 500, fontSize: 14.5 }}
                          primary={it.label} />
          </ListItemButton>
        );
      })}
    </List>
  );

  const drawer = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Stack direction="row" spacing={1.25} alignItems="center" sx={{ px: 2.5, py: 2.25 }}>
        <Avatar src={logo} variant="rounded" sx={{ width: 38, height: 38, bgcolor: "#fff", p: 0.5 }} />
        <Box>
          <Typography sx={{ fontFamily: "Sora", fontWeight: 800, fontSize: 15, lineHeight: 1 }}>
            Prabhu Capital
          </Typography>
          <Typography variant="caption" color="text.secondary">Prediction League</Typography>
        </Box>
      </Stack>
      <Divider />
      <Box sx={{ overflowY: "auto", flex: 1, pt: 1 }}>
        <Typography variant="overline" sx={{ px: 3, color: "text.secondary" }}>Play</Typography>
        <NavList items={staffNav} />
        {isAdmin && (
          <>
            <Divider sx={{ my: 1, mx: 2 }} />
            <Typography variant="overline" sx={{ px: 3, color: "text.secondary" }}>Administration</Typography>
            <NavList items={adminNav} />
          </>
        )}
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${DRAWER}px)` }, ml: { md: `${DRAWER}px` },
          background: theme.palette.mode === "dark" ? "rgba(7,11,22,0.55)" : "rgba(255,255,255,0.6)",
          backdropFilter: "blur(16px)", borderBottom: `1px solid ${theme.palette.divider}`, color: "text.primary",
        }}
      >
        <Toolbar sx={{ gap: 1 }}>
          <IconButton edge="start" onClick={() => setOpen(true)} sx={{ display: { md: "none" } }}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1, fontSize: 17 }}>
            {isAdmin && loc.pathname.startsWith("/admin") ? "Admin Console" : "World Cup 2026"}
          </Typography>
          <Tooltip title={mode === "dark" ? "Light mode" : "Dark mode"}>
            <IconButton onClick={toggle}>{mode === "dark" ? <LightModeIcon /> : <DarkModeIcon />}</IconButton>
          </Tooltip>
          <IconButton onClick={(e) => setAnchor(e.currentTarget)}>
            <Avatar sx={{ width: 34, height: 34, bgcolor: "primary.main", fontSize: 15 }}>
              {user?.full_name?.[0]?.toUpperCase()}
            </Avatar>
          </IconButton>
          <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
            <Box sx={{ px: 2, py: 1 }}>
              <Typography fontWeight={700}>{user?.full_name}</Typography>
              <Typography variant="caption" color="text.secondary">{user?.email}</Typography>
            </Box>
            <Divider />
            <MenuItem onClick={() => { setAnchor(null); nav("/profile"); }}>
              <ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon>Profile
            </MenuItem>
            <MenuItem onClick={logout}>
              <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>Log out
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: DRAWER }, flexShrink: { md: 0 } }}>
        <Drawer variant="temporary" open={open} onClose={() => setOpen(false)} ModalProps={{ keepMounted: true }}
                sx={{ display: { xs: "block", md: "none" }, "& .MuiDrawer-paper": { width: DRAWER } }}>
          {drawer}
        </Drawer>
        <Drawer variant="permanent" open
                sx={{ display: { xs: "none", md: "block" },
                      "& .MuiDrawer-paper": { width: DRAWER, borderRight: `1px solid ${theme.palette.divider}`,
                                              background: theme.palette.mode === "dark" ? "rgba(9,14,26,0.6)" : "rgba(255,255,255,0.55)",
                                              backdropFilter: "blur(16px)" } }}>
          {drawer}
        </Drawer>
      </Box>

      <Box component="main" sx={{ flexGrow: 1, width: { md: `calc(100% - ${DRAWER}px)` }, p: { xs: 2, md: 3.5 }, mt: 8 }}>
        <Outlet />
      </Box>
    </Box>
  );
}
