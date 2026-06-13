/**
 * The architecture review surface: a dependency-graph model, declarative rules
 * over it, a check that classifies a change as preserved/violated/at-risk, a
 * deriver that builds the model from real workspace manifests, and a flowchart
 * renderer that overlays the findings.
 */

export * from "./model.ts";
export * from "./rules.ts";
export * from "./workspace.ts";
export { toMermaidArchitecture } from "./mermaid.ts";
export { lontraRules } from "./lontra.ts";
