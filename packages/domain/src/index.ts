/**
 * Lontra's domain model package: the meta-model, Lontra's own model expressed
 * in it, a diff over two models, and a Mermaid renderer for visualizing either.
 */

export * from "./model.ts";
export * from "./diff.ts";
export { lontra } from "./lontra.ts";
export { toMermaid, toMermaidDiff } from "./mermaid.ts";
