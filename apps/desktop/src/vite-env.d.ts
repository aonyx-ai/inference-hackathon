/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Absolute base URL of the planner server; empty in dev (uses the proxy). */
  readonly VITE_API_BASE?: string;
  /**
   * Absolute path to the repository the research agents should explore. When
   * unset the planner server picks one (it dogfoods on its own checkout).
   */
  readonly VITE_REPO_ROOT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
