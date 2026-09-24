import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "src/main/index.ts"),
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "src/preload/index.ts"),
        },
      },
    },
  },
  renderer: {
    root: resolve(__dirname, "src/renderer"),
    plugins: [tailwindcss(), react()],
    resolve: {
      alias: {
        "@": resolve(__dirname, "src/renderer/src"),
      },
    },
    server: {
      port: 5174,
      strictPort: true,
      hmr: {
        overlay: true,
      },
      host: "127.0.0.1",
    },
    css: {
      devSourcemap: true,
    },
    // Force Tailwind to scan renderer src explicitly
    optimizeDeps: {
      include: ["react", "react-dom", "react-router-dom"],
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "src/renderer/index.html"),
        },
        output: {
          manualChunks: {
            react: ["react", "react-dom", "react-router-dom"],
            player: ["hls.js", "dashjs"],
          },
        },
      },
      chunkSizeWarningLimit: 1200,
    },
  },
});
