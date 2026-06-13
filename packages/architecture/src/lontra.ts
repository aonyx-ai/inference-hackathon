/**
 * Lontra's own architectural rules, dogfooded against its workspace. Each rule's
 * `intent` is the goal it protects — the rationale lives here, not in a separate
 * decision record. The rules encode the constraints behind the stack: a
 * platform-independent core and domain, a Node-only Mastra runtime confined to
 * the sidecar, and dependencies that only ever point inward.
 */

import type { Rule } from "./rules.ts";

export const lontraRules = [
  {
    id: "platform-independent-core",
    intent:
      "core and domain stay platform-independent so the UI, agents, and the shared model speak one language",
    forbid: { from: ["core", "domain"], to: { external: "@tauri-apps/*" } },
  },
  {
    id: "no-ui-in-shared",
    intent: "shared packages must not pull in the UI framework",
    forbid: { from: ["core", "domain", "planner"], to: { external: "react" } },
  },
  {
    id: "mastra-only-in-sidecar",
    intent:
      "Mastra is Node-only and owns secrets and run state; it lives in the planner sidecar, never the webview or Rust shell",
    confine: { to: { external: "@mastra/*" }, allowedFrom: ["planner"] },
  },
  {
    id: "dependencies-point-inward",
    intent:
      "libraries never depend on the app shell; dependencies point inward",
    forbid: {
      from: ["core", "domain", "planner"],
      to: { component: "desktop" },
    },
  },
] satisfies Rule[];
