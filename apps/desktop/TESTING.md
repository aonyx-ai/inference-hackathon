# Testing the Desktop App

The desktop app is tested at three levels: fast unit tests, agent-driven
exploration of the running app, and a real-backend end-to-end suite.

## Unit Tests

Two fast, hermetic layers run on every change:

- **Rust** — `just test-rust` runs `cargo test` against the backend. The `greet`
  command is covered by a direct unit test in [`src-tauri/src/lib.rs`][lib].
- **Frontend** — `just test-ts` runs `bun test`. The frontend tests render
  React components with [happy-dom][happy-dom] and [Testing Library][tl];
  `@tauri-apps/api/mocks` is available to mock the Tauri IPC layer when a
  component calls a command.

`just test` runs both. The full IPC path with the real ACL belongs in the
end-to-end suite rather than a mock-runtime unit test: the mock runtime cannot
reproduce the build-time resolved ACL, so it would not faithfully exercise a
command.

## Agent-Driven Testing

This app embeds [tauri-plugin-mcp][plugin] in debug builds so AI agents (for
example [Claude Code][cc]) can drive the real running desktop window:
screenshot it, query the DOM, click, type, evaluate JavaScript, and control the
window. The plugin is gated behind `#[cfg(debug_assertions)]`, so it is never
compiled into release builds.

### How It Works

Three pieces cooperate:

1. The Rust plugin, registered in [`src-tauri/src/lib.rs`][lib]. In debug builds
   it starts a Unix-domain socket server listening on `/tmp/tauri-mcp.sock`.
2. The [MCP server][server] (`tauri-plugin-mcp-server`), launched on demand via
   `npx` and connected to that socket. It exposes the automation tools over the
   Model Context Protocol.
3. The agent's MCP config at the repo root (`.mcp.json`), which tells the agent
   how to launch the server and which socket to connect to
   (`TAURI_MCP_IPC_PATH`).

The socket path in `.mcp.json` must match the `socket_path(...)` value passed to
`PluginConfig` in `lib.rs`. Both default to `/tmp/tauri-mcp.sock`.

### Starting the Dev App

From the repo root, start the desktop app in development mode:

```bash
bun run --filter @inference-hackathon/desktop tauri dev
```

This launches Vite on `http://localhost:1420` and opens the native window. Once
the window is up, the plugin's socket server is live and ready for an agent to
connect.

### Connecting an Agent

Open this repository in [Claude Code][cc]. The `.mcp.json` at the repo root is
picked up automatically and the `tauri-mcp` server is started on first tool use
(`npx` fetches `tauri-plugin-mcp-server`). No global install is required; to pin
the version instead, run `npm install -g tauri-plugin-mcp-server`.

The available tools are `take_screenshot`, `query_page`, `click`, `type_text`,
`mouse_action`, `navigate`, `execute_js`, `manage_storage`, `manage_window`, and
`wait_for`.

### Example Agent Loop

The tools compose into a screenshot-act-screenshot loop: capture the window,
drive it (click, type, navigate, evaluate JavaScript), and screenshot again to
confirm the result. This works against whatever the app currently renders.

## End-to-End Tests

The end-to-end suite drives the **real** webview through the embedded WebDriver
server, exercising the running app end to end with no mocking. Specs live in
`e2e/specs/` and interact with the app through standard WebdriverIO selectors
and assertions.

### Why This Setup

Apple ships no WebDriver for the embedded WKWebView, so the official Tauri stack
([`tauri-driver`][tauri-driver] + WebdriverIO) runs only on Linux and Windows —
never on the macOS dev machine. To get **one** WebdriverIO suite that works both
locally on macOS and in Linux CI, we use the cross-platform community plugin
[`tauri-plugin-webdriver`][wd-plugin] by Choochmeque.

Unlike `tauri-driver`, this plugin embeds a [W3C WebDriver][w3c] server directly
inside the app — WKWebView on macOS, WebKitGTK on Linux, WebView2 on Windows —
so the same code path works everywhere. It is an **optional** dependency behind
a non-default `webdriver` Cargo feature, and its registration is gated on both
`#[cfg(debug_assertions)]` and `#[cfg(feature = "webdriver")]`, so it is only
ever linked into builds that explicitly opt in for testing — never into a normal
release build. (Cargo does not support `cfg(debug_assertions)` for selecting
dependencies, hence the feature.)

The trade-off: because the server lives inside the app, there is no separate
driver process to launch it. WebdriverIO connects to an _already-running_ app.
The [`wdio.conf.ts`][conf] therefore spawns the built debug binary itself in
`onPrepare`, waits for the embedded server to answer on `127.0.0.1:4445`, runs
the specs, and kills the process in `onComplete`.

### Running Locally on macOS

You need a **debug** build of the app with the `webdriver` feature enabled, so
the embedded WebDriver server is linked in. Build it once, then run the suite:

```sh
cd apps/desktop

# Build the debug app. This runs the frontend build, then produces a debug
# binary at src-tauri/target/debug/. The `-- --features webdriver` is forwarded
# to cargo and links in the embedded WebDriver server.
bun run tauri build --debug --no-bundle -- --features webdriver

# Run the WebdriverIO suite against that binary.
bun run e2e
```

Or, from the repo root, via the [`justfile`][justfile]:

```sh
just e2e
```

The config resolves the binary automatically — it looks for the bundled
`Inference Hackathon` product binary first, then the bare `desktop` cargo
binary, under `src-tauri/target/debug/` (honoring `CARGO_TARGET_DIR`).

You can also build the binary with cargo directly if you have already run the
frontend build (`bun run build`) so the bundled assets exist:

```sh
cd apps/desktop/src-tauri && cargo build --features webdriver
```

### Running in CI

CI runs the suite on `ubuntu-latest` (see [`.github/workflows/e2e.yml`][ci]).
The Linux runner installs WebKitGTK and the Tauri build dependencies, builds the
debug app, and runs the suite under `xvfb` for a headless display. A macOS CI
runner is intentionally omitted — the macOS value is fast local iteration, not a
CI gate.

[cc]: https://docs.anthropic.com/en/docs/claude-code
[ci]: ../../.github/workflows/e2e.yml
[conf]: ./e2e/wdio.conf.ts
[happy-dom]: https://github.com/capricorn86/happy-dom
[justfile]: ../../justfile
[lib]: ./src-tauri/src/lib.rs
[plugin]: https://github.com/P3GLEG/tauri-plugin-mcp
[server]: https://www.npmjs.com/package/tauri-plugin-mcp-server
[tauri-driver]: https://crates.io/crates/tauri-driver
[tl]: https://testing-library.com/docs/react-testing-library/intro/
[w3c]: https://www.w3.org/TR/webdriver/
[wd-plugin]: https://github.com/Choochmeque/tauri-plugin-webdriver
