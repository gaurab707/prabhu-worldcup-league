import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { createAppTheme, type Mode } from "../theme/theme";

const ColorModeContext = createContext<{ mode: Mode; toggle: () => void }>({
  mode: "dark",
  toggle: () => {},
});

const STORAGE_KEY = "pcwc_mode";

export function ColorModeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>(
    (localStorage.getItem(STORAGE_KEY) as Mode) || "dark",
  );
  const theme = useMemo(() => createAppTheme(mode), [mode]);
  const toggle = () => {
    setMode((m) => {
      const next = m === "dark" ? "light" : "dark";
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  };
  return (
    <ColorModeContext.Provider value={{ mode, toggle }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}

export const useColorMode = () => useContext(ColorModeContext);
