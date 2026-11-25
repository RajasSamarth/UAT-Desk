import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    open: true,
    proxy: {
      // Route API and binary/template endpoints to the local Express backend
      "^/api": "http://localhost:3000",
      "^/static": "http://localhost:3000",
      "^/healthz": "http://localhost:3000",
      "^/favicon.ico": "http://localhost:3000",
      "^/company/template\\.(csv|xlsx)$": "http://localhost:3000",
      "^/company/projects/[^/]+/(signature|certificate\\.pdf)$": "http://localhost:3000",
      "^/company/projects/[^/]+/items/[^/]+/screenshot$": "http://localhost:3000",
      "^/p/[^/]+/(signature|certificate\\.pdf)$": "http://localhost:3000",
      "^/p/[^/]+/items/[^/]+/screenshot$": "http://localhost:3000",
    },
  },
});
