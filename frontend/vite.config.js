import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Dev: use relative /api paths (or set VITE_API_URL to backend port)
    // For single-port setup, build frontend and run backend which serves both
  },
});
