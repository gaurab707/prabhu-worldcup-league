import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { SnackbarProvider } from "notistack";
import { ColorModeProvider } from "./context/ColorModeContext";
import { AuthProvider } from "./context/AuthContext";
import App from "./App";

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1, staleTime: 15_000 } },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ColorModeProvider>
        <SnackbarProvider
          maxSnack={3}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          autoHideDuration={3500}
        >
          <AuthProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </AuthProvider>
        </SnackbarProvider>
      </ColorModeProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
