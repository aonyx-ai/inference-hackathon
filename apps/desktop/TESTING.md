# Agent-Driven Testing

This app embeds [tauri-plugin-mcp][plugin] in debug builds so AI agents (for
example [Claude Code][cc]) can drive the real running desktop window:
screenshot it, query the DOM, click, type, evaluate JavaScript, and control the
window. The plugin is gated behind `#[cfg(debug_assertions)]`, so it is never
compiled into release builds.

## How It Works

Three pieces cooperate:

1. The Rust plugin, registered in `src-tauri/src/lib.rs`. In debug builds it
   starts a Unix-domain socket server listening on `/tmp/tauri-mcp.sock`.
2. The [MCP server][server] (`tauri-plugin-mcp-server`), launched on demand via
   `npx` and connected to that socket. It exposes the automation tools over the
   Model Context Protocol.
3. The agent's MCP config at the repo root (`.mcp.json`), which tells the agent
   how to launch the server and which socket to connect to
   (`TAURI_MCP_IPC_PATH`).

The socket path in `.mcp.json` must match the `socket_path(...)` value passed to
`PluginConfig` in `lib.rs`. Both default to `/tmp/tauri-mcp.sock`.

## Starting The Dev App

From the repo root, start the desktop app in development mode:

```bash
bun run --filter @inference-hackathon/desktop tauri dev
```

This launches Vite on `http://localhost:1420` and opens the native window. Once
the window is up, the plugin's socket server is live and ready for an agent to
connect.

## Connecting An Agent

Open this repository in [Claude Code][cc]. The `.mcp.json` at the repo root is
picked up automatically and the `tauri-mcp` server is started on first tool use
(`npx` fetches `tauri-plugin-mcp-server`). No global install is required; to
pin the version instead, run `npm install -g tauri-plugin-mcp-server`.

The available tools are `take_screenshot`, `query_page`, `click`, `type_text`,
`mouse_action`, `navigate`, `execute_js`, `manage_storage`, `manage_window`,
and `wait_for`.

## Example Agent Loop

A minimal end-to-end check against the default UI (the Greet form):

1. `take_screenshot` — confirm the window rendered and capture the baseline.
2. `type_text` — focus the name input and type a name (for example `Tauri`).
3. `click` — click the Greet button.
4. `take_screenshot` — confirm the greeting (`Hello, Tauri! ...`) is rendered.

[plugin]: https://github.com/P3GLEG/tauri-plugin-mcp
[server]: https://www.npmjs.com/package/tauri-plugin-mcp-server
[cc]: https://docs.anthropic.com/en/docs/claude-code
