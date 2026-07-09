import { createTheme, alpha, type Theme } from "@mui/material/styles";

/**
 * Brand palette derived from the Prabhu Capital mark (deep azure + warm amber)
 * combined with a football-pitch green for "success"/points. The look is a dark
 * glassmorphism dashboard by default with a fully realised light mode.
 */
export const BRAND = {
  azure: "#3B82F6",
  azureDeep: "#2563EB",
  amber: "#F59E0B",
  amberBright: "#FBBF24",
  pitch: "#22C55E",
  danger: "#EF4444",
};

export type Mode = "dark" | "light";

const dark = {
  bg: "#070B16",
  bgElevated: "#0C1324",
  surface: "rgba(255,255,255,0.045)",
  surfaceStrong: "rgba(255,255,255,0.07)",
  border: "rgba(255,255,255,0.09)",
  text: "#E7ECF5",
  textMuted: "#93A0B8",
};

const light = {
  bg: "#EEF2FA",
  bgElevated: "#FFFFFF",
  surface: "rgba(255,255,255,0.72)",
  surfaceStrong: "rgba(255,255,255,0.9)",
  border: "rgba(15,23,42,0.09)",
  text: "#0F1B33",
  textMuted: "#5B6B86",
};

export function tokens(mode: Mode) {
  return mode === "dark" ? dark : light;
}

export function createAppTheme(mode: Mode): Theme {
  const t = tokens(mode);
  return createTheme({
    palette: {
      mode,
      primary: { main: BRAND.azure, dark: BRAND.azureDeep },
      secondary: { main: BRAND.amber },
      success: { main: BRAND.pitch },
      error: { main: BRAND.danger },
      background: { default: t.bg, paper: t.bgElevated },
      text: { primary: t.text, secondary: t.textMuted },
      divider: t.border,
    },
    shape: { borderRadius: 16 },
    typography: {
      fontFamily: "Inter, system-ui, -apple-system, sans-serif",
      h1: { fontFamily: "Sora, sans-serif", fontWeight: 800, letterSpacing: "-0.02em" },
      h2: { fontFamily: "Sora, sans-serif", fontWeight: 700, letterSpacing: "-0.02em" },
      h3: { fontFamily: "Sora, sans-serif", fontWeight: 700, letterSpacing: "-0.01em" },
      h4: { fontFamily: "Sora, sans-serif", fontWeight: 700 },
      h5: { fontFamily: "Sora, sans-serif", fontWeight: 600 },
      h6: { fontFamily: "Sora, sans-serif", fontWeight: 600 },
      button: { textTransform: "none", fontWeight: 600 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: t.bg,
            backgroundImage:
              mode === "dark"
                ? `radial-gradient(1200px 600px at 12% -8%, ${alpha(BRAND.azure, 0.16)}, transparent 60%),
                   radial-gradient(1000px 620px at 100% 0%, ${alpha(BRAND.amber, 0.10)}, transparent 55%),
                   radial-gradient(900px 700px at 50% 120%, ${alpha(BRAND.pitch, 0.08)}, transparent 60%)`
                : `radial-gradient(1100px 560px at 8% -10%, ${alpha(BRAND.azure, 0.14)}, transparent 60%),
                   radial-gradient(900px 560px at 100% 0%, ${alpha(BRAND.amber, 0.12)}, transparent 55%)`,
            backgroundAttachment: "fixed",
          },
          "*::-webkit-scrollbar": { width: 10, height: 10 },
          "*::-webkit-scrollbar-thumb": {
            background: alpha(t.text, 0.18),
            borderRadius: 8,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
            backgroundColor: t.surface,
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            border: `1px solid ${t.border}`,
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { borderRadius: 12, paddingInline: 18, paddingBlock: 9 },
          containedPrimary: {
            background: `linear-gradient(135deg, ${BRAND.azure}, ${BRAND.azureDeep})`,
            boxShadow: `0 8px 24px ${alpha(BRAND.azure, 0.35)}`,
          },
        },
      },
      MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
      MuiTextField: { defaultProps: { variant: "outlined", size: "small" } },
      MuiTooltip: {
        styleOverrides: {
          tooltip: { fontSize: 12, borderRadius: 8, background: alpha("#0B1324", 0.95) },
        },
      },
    },
  });
}

/** Reusable glass surface style for custom cards. */
export const glassSx = (theme: Theme) => ({
  background:
    theme.palette.mode === "dark" ? dark.surface : light.surface,
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 20,
});
