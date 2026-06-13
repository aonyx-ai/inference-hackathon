# Architecture Review (Example)

<!-- Generated from `packages/architecture`. Run `just render-architecture` to update. -->

A proposed change — the desktop webview calling the model runtime directly —
checked against Lontra's architectural rules. The report classifies every rule,
and the graph reddens the offending dependency so the violation is visible at a
glance rather than buried in a diff.

## Report

Architecture check: 1 violated, 0 at-risk, 3 preserved

### Violated

- mastra-only-in-sidecar — @inference-hackathon/desktop depends on @mastra/core
  Mastra is Node-only and owns secrets and run state; it lives in the planner sidecar, never the webview or Rust shell

### Preserved

- platform-independent-core
- no-ui-in-shared
- dependencies-point-inward

## Diagram

```mermaid
flowchart LR
  n0["core"]
  n1["domain"]
  n2["planner"]
  n3["desktop"]
  n4(["@mastra/core"])
  n5(["@mastra/libsql"])
  n6(["zod"])
  n7(["react"])
  n8(["@tauri-apps/api"])
  n2 --> n4
  n2 --> n5
  n2 --> n6
  n3 --> n0
  n3 --> n7
  n3 --> n8
  n3 --> n4
  linkStyle 6 stroke:#cb2431,stroke-width:2px
```
