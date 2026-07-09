import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server on port 3000, accessible over the LAN (host: true).
// The backend URL is read from VITE_API_URL at build/runtime.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    strictPort: true,
  },
  preview: {
    port: 3000,
    host: true,
    strictPort: true,
  },
});
