import { expect, test } from "bun:test";

import { lontraRules } from "./lontra.ts";
import { toMermaidArchitecture } from "./mermaid.ts";
import { check, type Rule } from "./rules.ts";
import { type Manifest, toArchitecture } from "./workspace.ts";

const confineMastra: Rule = {
  id: "mastra-only-in-sidecar",
  intent: "Mastra stays in the sidecar",
  confine: { to: { external: "@mastra/*" }, allowedFrom: ["planner"] },
};

test("renders a flowchart with a node per component and external dependency", () => {
  const architecture = toArchitecture([
    { id: "desktop", name: "desktop", dependencies: { react: "^19" } },
  ]);
  const diagram = toMermaidArchitecture(architecture);

  expect(diagram).toStartWith("flowchart LR");
  expect(diagram).toContain('["desktop"]'); // internal component: rectangle
  expect(diagram).toContain('(["react"])'); // external package: stadium
});

test("a clean architecture has no highlighted links", () => {
  const architecture = toArchitecture([
    { id: "planner", name: "planner", dependencies: { "@mastra/core": "^1" } },
  ]);
  const diagram = toMermaidArchitecture(
    architecture,
    check(architecture, lontraRules),
  );

  expect(diagram).not.toContain("linkStyle");
});

test("a violation reds-out exactly the offending edge by link index", () => {
  // planner has no deps, so desktop -> @mastra/core is the only edge: index 0.
  const architecture = toArchitecture([
    { id: "planner", name: "planner", dependencies: {} },
    { id: "desktop", name: "desktop", dependencies: { "@mastra/core": "^1" } },
  ]);
  const diagram = toMermaidArchitecture(
    architecture,
    check(architecture, [confineMastra]),
  );

  expect(diagram).toContain("linkStyle 0 stroke:#cb2431");
  expect(diagram.match(/linkStyle/g)).toHaveLength(1);
});

test("an allowed edge to the same target is left unstyled", () => {
  // Both planner (allowed) and desktop (not) import Mastra; only desktop's reds.
  const architecture = toArchitecture([
    { id: "planner", name: "planner", dependencies: { "@mastra/core": "^1" } },
    { id: "desktop", name: "desktop", dependencies: { "@mastra/core": "^1" } },
  ]);
  const diagram = toMermaidArchitecture(
    architecture,
    check(architecture, [confineMastra]),
  );

  // planner -> mastra is edge 0 (unstyled), desktop -> mastra is edge 1 (red).
  expect(diagram).toContain("linkStyle 1 stroke:#cb2431");
  expect(diagram.match(/linkStyle/g)).toHaveLength(1);
});

test("findings carrying real display names still match the graph edges", () => {
  const manifests: Manifest[] = [
    { id: "planner", name: "@inference-hackathon/planner", dependencies: {} },
    {
      id: "desktop",
      name: "@inference-hackathon/desktop",
      dependencies: { "@mastra/core": "^1" },
    },
  ];
  const architecture = toArchitecture(manifests);
  const diagram = toMermaidArchitecture(
    architecture,
    check(architecture, lontraRules),
  );

  // The finding edge uses package display names; the renderer maps them back.
  expect(diagram.match(/linkStyle \d+ stroke:#cb2431/g)).toHaveLength(1);
});
