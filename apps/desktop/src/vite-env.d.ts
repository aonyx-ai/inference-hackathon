/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Absolute base URL of the planner server; empty in dev (uses the proxy). */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
