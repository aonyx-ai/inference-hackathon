import { expect, test } from "bun:test";

import {
  parseMermaidClassDiagram,
  parseMermaidFlowchart,
  parseMermaidGraph,
} from "./mermaid-graph.ts";

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

test("dispatches by the first directive", () => {
  expect(parseMermaidGraph(FLOWCHART).nodes).toHaveLength(3);
  expect(parseMermaidGraph("classDiagram\n  class A {\n  }").nodes).toEqual([
    { id: "A", label: "A" },
  ]);
});

const DIAGRAM = `classDiagram
  direction LR
  namespace PlanningContext {
  class Session {
    <<AggregateRoot>>
    +SessionId id 🔑
    +FeatureRequest request
  }
  class FeatureRequest {
    <<ValueObject>>
    +string prompt
  }
  }
  namespace ArtifactContext {
  class Artifact {
    <<AggregateRoot>>
    +ArtifactId id 🔑
  }
  class DomainModelArtifact {
    <<Entity>>
  }
  }
  Session *-- "1" FeatureRequest : request
  Session --> "*" Artifact : artifacts
  Artifact <|-- DomainModelArtifact
  note for Session "Holds exactly one Artifact per surface"`;

test("parses classes into grouped nodes", () => {
  const { nodes } = parseMermaidClassDiagram(DIAGRAM);
  expect(nodes).toEqual([
    { id: "Session", label: "Session", group: "Planning" },
    { id: "FeatureRequest", label: "FeatureRequest", group: "Planning" },
    { id: "Artifact", label: "Artifact", group: "Artifact" },
    {
      id: "DomainModelArtifact",
      label: "DomainModelArtifact",
      group: "Artifact",
    },
  ]);
});

test("parses relationships into edges, stripping cardinality and keeping labels", () => {
  const { edges } = parseMermaidClassDiagram(DIAGRAM);
  expect(edges).toEqual([
    { from: "Session", to: "FeatureRequest", label: "request" },
    { from: "Session", to: "Artifact", label: "artifacts" },
    { from: "Artifact", to: "DomainModelArtifact" },
  ]);
});

test("ignores fields, stereotypes, and notes", () => {
  const { nodes, edges } = parseMermaidClassDiagram(DIAGRAM);
  // Four classes, three relationships — fields and the note contribute neither.
  expect(nodes).toHaveLength(4);
  expect(edges).toHaveLength(3);
});
