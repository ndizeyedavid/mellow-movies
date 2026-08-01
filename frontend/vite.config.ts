import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 1200,
    rolldownOptions: {
      output: {
        // Vendor groups: stable package chunks that can be cached long-term
        // independently of app code. Heavy players load only on /watch.
        codeSplitting: {
          groups: [
            {
              name: "react-vendor",
              test: /node_modules[\\/](react|react-dom|react-router|react-router-dom)[\\/]/,
            },
            {
              name: "icons",
              test: /node_modules[\\/]react-icons[\\/]/,
            },
            {
              name: "players",
              test: /node_modules[\\/](hls\.js|dashjs)[\\/]/,
            },
          ],
        },
      },
    },
  },
});
