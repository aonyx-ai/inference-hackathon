import { type ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { platform } from "node:os";
import { resolve } from "node:path";

// The cross-platform `tauri-plugin-webdriver` embeds a W3C WebDriver server
// (default port 4445) inside the *debug* app binary. Unlike the official
// `tauri-driver`, there is no separate driver process that spawns the app:
// the app must already be running before WebdriverIO connects to it. So we
// launch the built debug binary ourselves in `onPrepare`, wait for the
// embedded server to answer, drive it, then tear the process down.

const HOST = "127.0.0.1";
const PORT = 4445;

const TAURI_ROOT = resolve(import.meta.dirname, "..", "src-tauri");

/**
 * Resolve the built debug binary produced by `cargo tauri build --debug`
 * (or a plain `cargo build`). The bundled product name is "Inference
 * Hackathon"; the bare cargo binary keeps the crate name "desktop".
 */
function resolveBinary(): string {
  const targetDir = process.env.CARGO_TARGET_DIR
    ? resolve(process.env.CARGO_TARGET_DIR, "debug")
    : resolve(TAURI_ROOT, "target", "debug");

  const candidates =
    platform() === "win32"
      ? ["Inference Hackathon.exe", "desktop.exe"]
      : ["Inference Hackathon", "desktop"];

  for (const name of candidates) {
    const candidate = resolve(targetDir, name);
    if (existsSync(candidate)) return candidate;
  }

  throw new Error(
    `No debug app binary found in ${targetDir}. Build it first with:\n` +
      `  cd apps/desktop && bun run tauri build --debug\n` +
      `Looked for: ${candidates.join(", ")}`,
  );
}

let appProcess: ChildProcess | undefined;

async function waitForServer(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://${HOST}:${PORT}/status`);
      if (res.ok) return;
    } catch {
      // server not up yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(
    `WebDriver server never came up on http://${HOST}:${PORT} within ${timeoutMs}ms. ` +
      `Is the plugin registered under #[cfg(debug_assertions)] and is this a debug build?`,
  );
}

export const config: WebdriverIO.Config = {
  runner: "local",
  tsConfigPath: resolve(import.meta.dirname, "tsconfig.json"),

  specs: ["./specs/**/*.e2e.ts"],
  maxInstances: 1,

  // Talk raw W3C WebDriver to the server embedded in the app. There is no
  // browser/driver binary for WebdriverIO to manage, so we point it at the
  // already-running endpoint and disable its session-spawning behaviour.
  hostname: HOST,
  port: PORT,
  path: "/",
  automationProtocol: "webdriver",

  capabilities: [
    {
      // The plugin accepts but does not process capabilities; keep it empty.
      // `browserName` is intentionally omitted so WebdriverIO does not try to
      // download or launch a real browser driver.
    },
  ],

  logLevel: "info",
  framework: "mocha",
  reporters: ["spec"],
  mochaOpts: {
    ui: "bdd",
    timeout: 60_000,
  },

  // Launch the real debug app (which boots the embedded WebDriver server),
  // then block until that server answers before any session is created.
  onPrepare: async () => {
    const binary = resolveBinary();
    appProcess = spawn(binary, [], {
      stdio: "inherit",
      env: { ...process.env, TAURI_WEBDRIVER_PORT: String(PORT) },
    });
    // If the app dies before the server answers, waitForServer surfaces it.
    await waitForServer(30_000);
  },

  onComplete: async () => {
    appProcess?.kill("SIGTERM");
    appProcess = undefined;
  },
};
