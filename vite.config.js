import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/",
  server: {
    proxy: {
      "/dev-media-proxy": {
        target: "https://api.geohabita.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/dev-media-proxy/, "/media"),
        secure: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;

          if (id.includes("pdfjs-dist")) {
            return "pdf";
          }

          if (
            id.includes("@react-google-maps") ||
            id.includes("@googlemaps")
          ) {
            return "google-maps";
          }

          if (id.includes("idb") || id.includes("lz-string")) {
            return "storage";
          }

          if (
            id.includes("@photo-sphere-viewer") ||
            id.includes("three") ||
            id.includes("uevent")
          ) {
            return "viewer360";
          }

          if (
            id.includes("react") ||
            id.includes("react-dom") ||
            id.includes("react-router-dom")
          ) {
            return "react-vendor";
          }
        },
      },
    },
  },
});
