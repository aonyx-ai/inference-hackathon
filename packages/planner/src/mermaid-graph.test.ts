import { expect, test } from "bun:test";

import { parseMermaidClassDiagram } from "./mermaid-graph.ts";

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
