import { expect, test } from "bun:test";

import { parseMermaidFlowchart } from "./mermaid-graph.ts";

const FLOWCHART = `flowchart LR
  n0["core"]
  n1["planner"]
  n2(["@mastra/core"])
  n1 --> n0
  n1 --> n2
  linkStyle 1 stroke:#cb2431,stroke-width:2px`;

test("parses a flowchart's nodes, grouped internal vs external by shape", () => {
  const { nodes } = parseMermaidFlowchart(FLOWCHART);
  expect(nodes).toEqual([
    { id: "core", label: "core", group: "internal" },
    { id: "planner", label: "planner", group: "internal" },
    { id: "@mastra/core", label: "@mastra/core", group: "external" },
  ]);
});

test("translates a flowchart's opaque edge ids to labels, dropping linkStyle", () => {
  const { edges } = parseMermaidFlowchart(FLOWCHART);
  expect(edges).toEqual([
    { from: "planner", to: "core" },
    { from: "planner", to: "@mastra/core" },
  ]);
});
