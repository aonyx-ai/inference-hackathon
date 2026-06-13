/**
 * Render a {@link DomainModel} as a Mermaid class diagram. Bounded contexts
 * become namespaces, entities become classes annotated with their DDD kind,
 * fields become members, and the derived edges become typed relationships.
 * GitHub renders the output inline, so the diagram doubles as documentation.
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

function renderField(field: Field, names: ReadonlyMap<string, string>): string {
  let type = typeName(field.type, names);
  if (field.collection) type += "[]";
  if (field.optional) type += "?";
  const mark = field.role === "Identity" ? " 🔑" : "";
  return `    +${type} ${field.name}${mark}`;
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
