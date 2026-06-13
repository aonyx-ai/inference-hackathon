/**
 * Render a {@link DomainModel} as a Mermaid class diagram. Bounded contexts
 * become namespaces, entities become classes annotated with their DDD kind,
 * fields become members, and the derived edges become typed relationships.
 * GitHub renders the output inline, so the diagram doubles as documentation.
 *
 * {@link toMermaidDiff} renders two models overlaid: added, removed, and
 * modified nodes are colored, and field and edge changes are marked with the
 * familiar `+` / `-` / `~` so a reviewer literally sees the diff on the graph.
 */

import {
  deriveEdges,
  type DomainEntity,
  type DomainModel,
  type Edge,
  type Field,
  type TypeRef,
} from "./model.ts";

function typeName(type: TypeRef, names: ReadonlyMap<string, string>): string {
  switch (type.kind) {
    case "Scalar":
      return type.name;
    case "Contains":
      return names.get(type.target) ?? type.target;
    case "Reference":
      return `${names.get(type.target) ?? type.target}Id`;
  }
}

function fieldTypeString(
  field: Field,
  names: ReadonlyMap<string, string>,
): string {
  let type = typeName(field.type, names);
  if (field.collection) type += "[]";
  if (field.optional) type += "?";
  return type;
}

function renderField(field: Field, names: ReadonlyMap<string, string>): string {
  const key = field.role === "Identity" ? " 🔑" : "";
  return `    +${fieldTypeString(field, names)} ${field.name}${key}`;
}

function renderEntity(
  entity: DomainEntity,
  names: ReadonlyMap<string, string>,
): string {
  const lines = [`  class ${entity.name} {`, `    <<${entity.kind}>>`];
  for (const field of entity.fields) lines.push(renderField(field, names));
  lines.push("  }");
  return lines.join("\n");
}

const ARROW: Record<Edge["kind"], string> = {
  Contains: "*--",
  ReferencesById: "-->",
  Association: "-->",
  Inheritance: "<|--",
};

function renderEdge(edge: Edge, names: ReadonlyMap<string, string>): string {
  const from = names.get(edge.from) ?? edge.from;
  const to = names.get(edge.to) ?? edge.to;
  if (edge.kind === "Inheritance") return `  ${from} <|-- ${to}`;
  const card = edge.cardinality ? ` "${edge.cardinality}"` : "";
  const label = edge.label ? ` : ${edge.label}` : "";
  return `  ${from} ${ARROW[edge.kind]}${card} ${to}${label}`;
}

export function toMermaid(model: DomainModel): string {
  const names = new Map(model.entities.map((e) => [e.id, e.name]));
  const lines = ["classDiagram", "  direction LR"];

  for (const context of model.contexts) {
    // Suffix the namespace so a context never collides with an entity of the
    // same name (e.g. the Artifact context and the Artifact entity); Mermaid
    // treats a self-parenting namespace as a cycle and silently aborts.
    lines.push(`  namespace ${context.name.replace(/\s+/g, "")}Context {`);
    for (const entity of model.entities) {
      if (entity.context !== context.id) continue;
      lines.push(renderEntity(entity, names));
    }
    lines.push("  }");
  }

  for (const edge of deriveEdges(model)) lines.push(renderEdge(edge, names));

  for (const entity of model.entities) {
    if (!entity.invariants?.length) continue;
    lines.push(`  note for ${entity.name} "${entity.invariants.join("; ")}"`);
  }

  return lines.join("\n");
}

type NodeStatus = "added" | "removed" | "modified" | "unchanged";

/** A leading marker repurposing Mermaid's member visibility glyphs as diff signs. */
type Mark = "+" | "-" | "~" | "";

function sameTypeRef(a: TypeRef, b: TypeRef): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "Scalar") return a.name === (b as { name: string }).name;
  return a.target === (b as { target: string }).target;
}

function fieldChanged(a: Field, b: Field): boolean {
  return (
    a.name !== b.name ||
    !sameTypeRef(a.type, b.type) ||
    Boolean(a.optional) !== Boolean(b.optional) ||
    Boolean(a.collection) !== Boolean(b.collection) ||
    (a.role ?? "Normal") !== (b.role ?? "Normal")
  );
}

function invariantsDiffer(
  a: readonly string[] = [],
  b: readonly string[] = [],
): boolean {
  if (a.length !== b.length) return true;
  const seen = new Set(a);
  return b.some((text) => !seen.has(text));
}

function renderFieldDiff(
  field: Field,
  names: ReadonlyMap<string, string>,
  mark: Mark,
): string {
  const key = field.role === "Identity" ? " 🔑" : "";
  return `    ${mark}${fieldTypeString(field, names)} ${field.name}${key}`;
}

function renderEntityDiff(
  before: DomainEntity | undefined,
  after: DomainEntity | undefined,
  names: ReadonlyMap<string, string>,
): { text: string; status: NodeStatus } {
  const display = after ?? before;
  if (display === undefined)
    throw new Error("an entity must exist in before or after");

  const body: string[] = [];
  let status: NodeStatus;

  if (before === undefined) {
    status = "added";
    for (const field of display.fields)
      body.push(renderFieldDiff(field, names, "+"));
  } else if (after === undefined) {
    status = "removed";
    for (const field of before.fields)
      body.push(renderFieldDiff(field, names, "-"));
  } else {
    const beforeById = new Map(before.fields.map((f) => [f.id, f]));
    const afterById = new Map(after.fields.map((f) => [f.id, f]));
    let changed =
      before.name !== after.name ||
      before.kind !== after.kind ||
      before.context !== after.context;

    for (const field of after.fields) {
      const prev = beforeById.get(field.id);
      if (prev === undefined) {
        body.push(renderFieldDiff(field, names, "+"));
        changed = true;
      } else if (fieldChanged(prev, field)) {
        body.push(renderFieldDiff(field, names, "~"));
        changed = true;
      } else {
        body.push(renderFieldDiff(field, names, ""));
      }
    }
    for (const field of before.fields) {
      if (!afterById.has(field.id)) {
        body.push(renderFieldDiff(field, names, "-"));
        changed = true;
      }
    }
    if (invariantsDiffer(before.invariants, after.invariants)) changed = true;
    status = changed ? "modified" : "unchanged";
  }

  const head = [`  class ${display.name} {`, `    <<${display.kind}>>`];
  return { text: [...head, ...body, "  }"].join("\n"), status };
}

function edgeChanged(a: Edge, b: Edge): boolean {
  return a.cardinality !== b.cardinality || a.kind !== b.kind;
}

function renderEdgeDiff(
  edge: Edge,
  names: ReadonlyMap<string, string>,
  mark: Mark,
): string {
  const from = names.get(edge.from) ?? edge.from;
  const to = names.get(edge.to) ?? edge.to;
  const tag = mark ? `${mark} ` : "";
  if (edge.kind === "Inheritance")
    return mark ? `  ${from} <|-- ${to} : ${mark}` : `  ${from} <|-- ${to}`;
  const card = edge.cardinality ? ` "${edge.cardinality}"` : "";
  const baseLabel = edge.label ?? "";
  const label = tag || baseLabel ? ` : ${tag}${baseLabel}` : "";
  return `  ${from} ${ARROW[edge.kind]}${card} ${to}${label}`;
}

/**
 * Render `before` and `after` overlaid as one diagram: every node from either
 * model is drawn once, colored by whether it was added, removed, or modified,
 * with field and edge changes marked `+` / `-` / `~`. Edges are diffed via
 * {@link deriveEdges}, so relationship changes fall out of the field changes.
 */
export function toMermaidDiff(before: DomainModel, after: DomainModel): string {
  const beforeById = new Map(before.entities.map((e) => [e.id, e]));
  const afterById = new Map(after.entities.map((e) => [e.id, e]));
  // After wins on a rename so a node and its edges share one display name.
  const names = new Map<string, string>();
  for (const e of before.entities) names.set(e.id, e.name);
  for (const e of after.entities) names.set(e.id, e.name);

  const entityIds = after.entities.map((e) => e.id);
  for (const e of before.entities)
    if (!afterById.has(e.id)) entityIds.push(e.id);

  const lines = ["classDiagram", "  direction LR"];
  const grouped: Record<NodeStatus, string[]> = {
    added: [],
    removed: [],
    modified: [],
    unchanged: [],
  };

  for (const id of entityIds) {
    const { text, status } = renderEntityDiff(
      beforeById.get(id),
      afterById.get(id),
      names,
    );
    lines.push(text);
    grouped[status].push(names.get(id) ?? id);
  }

  const edgesBefore = new Map(deriveEdges(before).map((e) => [e.id, e]));
  const edgesAfter = new Map(deriveEdges(after).map((e) => [e.id, e]));
  const edgeIds = [...edgesAfter.keys()];
  for (const id of edgesBefore.keys())
    if (!edgesAfter.has(id)) edgeIds.push(id);

  for (const id of edgeIds) {
    const prev = edgesBefore.get(id);
    const next = edgesAfter.get(id);
    const edge = next ?? prev;
    if (edge === undefined) continue;
    const mark: Mark =
      prev === undefined
        ? "+"
        : next === undefined
          ? "-"
          : edgeChanged(prev, next)
            ? "~"
            : "";
    lines.push(renderEdgeDiff(edge, names, mark));
  }

  lines.push("  classDef added fill:#e6ffed,stroke:#22863a,color:#22863a");
  lines.push("  classDef removed fill:#ffeef0,stroke:#cb2431,color:#cb2431");
  lines.push("  classDef modified fill:#fff5b1,stroke:#b08800,color:#735c0f");
  for (const status of ["added", "removed", "modified"] as const) {
    if (grouped[status].length > 0)
      lines.push(`  cssClass "${grouped[status].join(",")}" ${status}`);
  }

  return lines.join("\n");
}
