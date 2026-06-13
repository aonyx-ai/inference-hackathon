import { describe, expect, test } from "bun:test";

import { lontra } from "./lontra.ts";
import {
  deriveEdges,
  type DomainEntity,
  type DomainModel,
  validate,
} from "./model.ts";
import { toMermaid, toMermaidDiff } from "./mermaid.ts";

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

describe("toMermaidDiff", () => {
  const m = (...entities: DomainEntity[]): DomainModel => ({
    contexts: [{ id: "c", name: "Ctx" }],
    entities,
  });
  const order = (...fields: DomainEntity["fields"]): DomainEntity => ({
    id: "order",
    name: "Order",
    kind: "Entity",
    context: "c",
    fields,
  });
  const total = {
    id: "order.total",
    name: "total",
    type: { kind: "Scalar", name: "number" },
  } as const;
  const customer: DomainEntity = {
    id: "customer",
    name: "Customer",
    kind: "Entity",
    context: "c",
    fields: [
      {
        id: "customer.id",
        name: "id",
        type: { kind: "Scalar", name: "CustomerId" },
        role: "Identity",
      },
    ],
  };

  test("a model diffed against itself shows no status classes or diff marks", () => {
    const diagram = toMermaidDiff(lontra, lontra);
    expect(diagram).toStartWith("classDiagram");
    expect(diagram).not.toContain("cssClass");
    expect(diagram).not.toMatch(/^\s*[-+~]/m);
  });

  test("an added entity is colored and its fields are marked +", () => {
    const diagram = toMermaidDiff(m(), m(order(total)));
    expect(diagram).toContain('cssClass "Order" added');
    expect(diagram).toContain("    +number total");
  });

  test("a removed entity is colored and its fields are marked -", () => {
    const diagram = toMermaidDiff(m(order(total)), m());
    expect(diagram).toContain('cssClass "Order" removed');
    expect(diagram).toContain("    -number total");
  });

  test("a modified entity marks added, removed, and changed fields", () => {
    const before = m(order(total));
    const added = m(
      order(total, {
        id: "order.note",
        name: "note",
        type: { kind: "Scalar", name: "string" },
        optional: true,
      }),
    );
    const addedDiagram = toMermaidDiff(before, added);
    expect(addedDiagram).toContain('cssClass "Order" modified');
    expect(addedDiagram).toContain("    +string? note");
    expect(addedDiagram).toContain("    number total"); // unchanged: no mark

    const retyped = m(
      order({ ...total, type: { kind: "Scalar", name: "Money" } }),
    );
    expect(toMermaidDiff(before, retyped)).toContain("    ~Money total");

    expect(toMermaidDiff(before, m(order()))).toContain("    -number total");
  });

  test("a new reference field surfaces as an added, labeled edge", () => {
    const before = m(order(total), customer);
    const after = m(
      order(total, {
        id: "order.customer",
        name: "customer",
        type: { kind: "Reference", target: "customer" },
      }),
      customer,
    );
    const diagram = toMermaidDiff(before, after);
    expect(diagram).toContain('Order --> "1" Customer : + customer');
    expect(diagram).toContain('cssClass "Order" modified');
  });

  test("a rename uses the new name and colors the node modified", () => {
    const diagram = toMermaidDiff(
      m(order(total)),
      m({ ...order(total), name: "PurchaseOrder" }),
    );
    expect(diagram).toContain("class PurchaseOrder {");
    expect(diagram).toContain('cssClass "PurchaseOrder" modified');
  });

  test("includes the status color definitions", () => {
    expect(toMermaidDiff(m(), m(order(total)))).toContain(
      "classDef added fill:",
    );
  });
});
