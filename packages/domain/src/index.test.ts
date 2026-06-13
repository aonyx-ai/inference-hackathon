import { expect, test } from "bun:test";

import { lontra } from "./lontra.ts";
import { deriveEdges, validate } from "./model.ts";
import { toMermaid } from "./mermaid.ts";

test("Lontra's model is internally consistent", () => {
  expect(validate(lontra)).toEqual([]);
});

test("every reference and containment field projects to an edge", () => {
  const linkingFields = lontra.entities.flatMap((e) =>
    e.fields.filter((f) => f.type.kind !== "Scalar"),
  );
  const inheritance = lontra.entities.filter((e) => e.extends !== undefined);
  const edges = deriveEdges(lontra);

  expect(edges).toHaveLength(linkingFields.length + inheritance.length);
});

test("renders a class diagram grouped by bounded context", () => {
  const diagram = toMermaid(lontra);

  expect(diagram).toStartWith("classDiagram");
  expect(diagram).toContain("namespace PlanningContext {");
  expect(diagram).toContain("namespace ArtifactContext {");
  expect(diagram).toContain("class Session {");
  expect(diagram).toContain("<<AggregateRoot>>");
});

test("no bounded-context namespace collides with an entity name", () => {
  // A namespace named the same as a class makes Mermaid self-parent and
  // silently abort, so guard the disambiguation suffix against regressions.
  const diagram = toMermaid(lontra);
  const namespaces = [...diagram.matchAll(/namespace (\S+) \{/g)].map(
    (m) => m[1] ?? "",
  );
  const entityNames = new Set(lontra.entities.map((e) => e.name));

  expect(namespaces).toHaveLength(lontra.contexts.length);
  for (const namespace of namespaces)
    expect(entityNames.has(namespace)).toBe(false);
});

test("the meta-model describes itself, the recursion the demo relies on", () => {
  const names = new Set(lontra.entities.map((e) => e.name));

  expect(names).toContain("DomainEntity");
  expect(names).toContain("Field");
  expect(names).toContain("Relationship");
});
