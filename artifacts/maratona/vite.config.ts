import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// PORT/BASE_PATH eram injetados pelo Replit; agora têm padrão para que o
// build rode em qualquer máquina (PORT só importa para `vite dev`/`preview`).
const rawPort = process.env.PORT || "5173";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH || "/";

// Destino do proxy /api no `vite dev` (a API local).
const apiTarget = process.env.API_PROXY_TARGET || "http://localhost:8080";

export default defineConfig(({ command }) => ({
  base: basePath,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    // Sourcemap completo expõe o código-fonte a qualquer visitante; só no dev server.
    sourcemap: command !== "build",
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    fs: {
      strict: true,
    },
    proxy: {
      "/api": {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true,
  },
}));
