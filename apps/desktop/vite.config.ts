import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

/** Port the planner's Mastra server listens on; the `/api` proxy targets it. */
const PLANNER_PORT = 8787;

/**
 * Run the planner's Mastra server alongside the webview during `vite dev`, so a
 * single `bun run dev` — and therefore `tauri dev` — brings up both. The server
 * holds the API keys (loaded from the repo-root `.env` by Bun); the browser only
 * ever talks to it through the `/api` proxy configured below.
 */
function plannerServer(): PluginOption {
  const rootDir = fileURLToPath(new URL("../../", import.meta.url));
  let child: ChildProcess | undefined;

  return {
    name: "planner-server",
    apply: "serve",
    configureServer(server) {
      child = spawn(
        "bun",
        ["run", "--watch", "packages/planner/src/server.ts"],
        {
          cwd: rootDir,
          stdio: "inherit",
        },
      );
      const stop = () => child?.kill();
      server.httpServer?.once("close", stop);
      // @ts-expect-error process is a nodejs global
      process.once("exit", stop);
    },
  };
}

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), plannerServer()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
    // 4. forward the webview's `/api` calls to the planner server
    proxy: {
      "/api": `http://localhost:${PLANNER_PORT}`,
    },
  },
}));
