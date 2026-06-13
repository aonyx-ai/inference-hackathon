/**
 * Diffing two domain models into a reviewable changeset.
 *
 * The agent's job is to emit the desired target model while reusing the stable
 * ids from the previous one; `diff()` is what turns the two snapshots into an
 * explicit list of operations a developer can read. Because the ids are stable,
 * a rename surfaces as a single modify rather than a delete plus an add, and
 * because the graph is a projection of the fields, diffing the fields already
 * captures every relationship change — there is no separate edge diff to keep
 * in sync.
 *
 * Every operation is classified by {@link Compatibility} so a reviewer's eye
 * goes to the breaking changes first:
 * - `Additive` — backward-compatible (a new optional field, a loosened field, a
 *   dropped invariant, a new entity).
 * - `Breaking` — not backward-compatible (a removed field or entity, a retype,
 *   a new required field, a tightened field, a changed identity, a new
 *   invariant).
 * - `Cosmetic` — a pure rename, no change in meaning.
 */

import type {
  ContextId,
  DomainModel,
  Field,
  FieldRole,
  NodeId,
  NodeKind,
  TypeRef,
} from "./model.ts";

export type Compatibility = "Additive" | "Breaking" | "Cosmetic";

interface OpBase {
  readonly compat: Compatibility;
  /** The entity the change applies to, by display name, for readable output. */
  readonly entity: string;
}

export type Operation =
  | (OpBase & {
      readonly kind: "AddEntity";
      readonly entityId: NodeId;
      readonly entityKind: NodeKind;
    })
  | (OpBase & { readonly kind: "RemoveEntity"; readonly entityId: NodeId })
  | (OpBase & {
      readonly kind: "RenameEntity";
      readonly entityId: NodeId;
      readonly to: string;
    })
  | (OpBase & {
      readonly kind: "ChangeEntityKind";
      readonly entityId: NodeId;
      readonly from: NodeKind;
      readonly to: NodeKind;
    })
  | (OpBase & {
      readonly kind: "MoveEntity";
      readonly entityId: NodeId;
      readonly from: ContextId;
      readonly to: ContextId;
    })
  | (OpBase & {
      readonly kind: "AddField";
      readonly entityId: NodeId;
      readonly field: string;
      readonly type: string;
    })
  | (OpBase & {
      readonly kind: "RemoveField";
      readonly entityId: NodeId;
      readonly field: string;
    })
  | (OpBase & {
      readonly kind: "RenameField";
      readonly entityId: NodeId;
      readonly field: string;
      readonly to: string;
    })
  | (OpBase & {
      readonly kind: "RetypeField";
      readonly entityId: NodeId;
      readonly field: string;
      readonly from: string;
      readonly to: string;
    })
  | (OpBase & {
      readonly kind: "ChangeFieldOptionality";
      readonly entityId: NodeId;
      readonly field: string;
      readonly optional: boolean;
    })
  | (OpBase & {
      readonly kind: "ChangeFieldArity";
      readonly entityId: NodeId;
      readonly field: string;
      readonly collection: boolean;
    })
  | (OpBase & {
      readonly kind: "ChangeFieldRole";
      readonly entityId: NodeId;
      readonly field: string;
      readonly from: FieldRole;
      readonly to: FieldRole;
    })
  | (OpBase & {
      readonly kind: "AddInvariant";
      readonly entityId: NodeId;
      readonly text: string;
    })
  | (OpBase & {
      readonly kind: "RemoveInvariant";
      readonly entityId: NodeId;
      readonly text: string;
    });

export interface Changeset {
  readonly operations: readonly Operation[];
}

const ROLE = (field: Field): FieldRole => field.role ?? "Normal";

function sameType(a: TypeRef, b: TypeRef): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "Scalar") return a.name === (b as { name: string }).name;
  return a.target === (b as { target: string }).target;
}

function typeLabel(type: TypeRef, names: ReadonlyMap<NodeId, string>): string {
  switch (type.kind) {
    case "Scalar":
      return type.name;
    case "Contains":
      return `◇ ${names.get(type.target) ?? type.target}`;
    case "Reference":
      return `→ ${names.get(type.target) ?? type.target}`;
  }
}

function diffFields(
  entity: string,
  before: readonly Field[],
  after: readonly Field[],
  names: ReadonlyMap<NodeId, string>,
  ops: Operation[],
): void {
  const beforeById = new Map(before.map((f) => [f.id, f]));
  const afterById = new Map(after.map((f) => [f.id, f]));

  for (const field of before) {
    if (!afterById.has(field.id)) {
      ops.push({
        kind: "RemoveField",
        compat: "Breaking",
        entity,
        entityId: field.id,
        field: field.name,
      });
    }
  }

  for (const field of after) {
    if (beforeById.has(field.id)) continue;
    ops.push({
      kind: "AddField",
      compat: field.optional ? "Additive" : "Breaking",
      entity,
      entityId: field.id,
      field: field.name,
      type: typeLabel(field.type, names),
    });
  }

  for (const next of after) {
    const prev = beforeById.get(next.id);
    if (prev === undefined) continue;

    if (prev.name !== next.name) {
      ops.push({
        kind: "RenameField",
        compat: "Cosmetic",
        entity,
        entityId: next.id,
        field: prev.name,
        to: next.name,
      });
    }
    if (!sameType(prev.type, next.type)) {
      ops.push({
        kind: "RetypeField",
        compat: "Breaking",
        entity,
        entityId: next.id,
        field: next.name,
        from: typeLabel(prev.type, names),
        to: typeLabel(next.type, names),
      });
    }
    if (Boolean(prev.optional) !== Boolean(next.optional)) {
      ops.push({
        kind: "ChangeFieldOptionality",
        // Loosening (required -> optional) is safe; tightening is not.
        compat: next.optional ? "Additive" : "Breaking",
        entity,
        entityId: next.id,
        field: next.name,
        optional: Boolean(next.optional),
      });
    }
    if (Boolean(prev.collection) !== Boolean(next.collection)) {
      ops.push({
        kind: "ChangeFieldArity",
        compat: "Breaking",
        entity,
        entityId: next.id,
        field: next.name,
        collection: Boolean(next.collection),
      });
    }
    if (ROLE(prev) !== ROLE(next)) {
      ops.push({
        kind: "ChangeFieldRole",
        compat: "Breaking",
        entity,
        entityId: next.id,
        field: next.name,
        from: ROLE(prev),
        to: ROLE(next),
      });
    }
  }
}

function diffInvariants(
  entity: string,
  entityId: NodeId,
  before: readonly string[],
  after: readonly string[],
  ops: Operation[],
): void {
  const beforeSet = new Set(before);
  const afterSet = new Set(after);
  // A new invariant tightens the contract (breaking); dropping one loosens it.
  for (const text of after) {
    if (!beforeSet.has(text))
      ops.push({
        kind: "AddInvariant",
        compat: "Breaking",
        entity,
        entityId,
        text,
      });
  }
  for (const text of before) {
    if (!afterSet.has(text))
      ops.push({
        kind: "RemoveInvariant",
        compat: "Additive",
        entity,
        entityId,
        text,
      });
  }
}

/** Compute the changeset that turns `before` into `after`. */
export function diff(before: DomainModel, after: DomainModel): Changeset {
  const ops: Operation[] = [];
  const beforeById = new Map(before.entities.map((e) => [e.id, e]));
  const afterById = new Map(after.entities.map((e) => [e.id, e]));
  const names = new Map<NodeId, string>();
  for (const entity of [...before.entities, ...after.entities])
    names.set(entity.id, entity.name);

  for (const entity of before.entities) {
    if (!afterById.has(entity.id)) {
      ops.push({
        kind: "RemoveEntity",
        compat: "Breaking",
        entity: entity.name,
        entityId: entity.id,
      });
    }
  }

  for (const entity of after.entities) {
    if (beforeById.has(entity.id)) continue;
    ops.push({
      kind: "AddEntity",
      compat: "Additive",
      entity: entity.name,
      entityId: entity.id,
      entityKind: entity.kind,
    });
  }

  for (const next of after.entities) {
    const prev = beforeById.get(next.id);
    if (prev === undefined) continue;

    if (prev.name !== next.name) {
      ops.push({
        kind: "RenameEntity",
        compat: "Cosmetic",
        entity: prev.name,
        entityId: next.id,
        to: next.name,
      });
    }
    if (prev.kind !== next.kind) {
      ops.push({
        kind: "ChangeEntityKind",
        compat: "Breaking",
        entity: next.name,
        entityId: next.id,
        from: prev.kind,
        to: next.kind,
      });
    }
    if (prev.context !== next.context) {
      ops.push({
        kind: "MoveEntity",
        compat: "Breaking",
        entity: next.name,
        entityId: next.id,
        from: prev.context,
        to: next.context,
      });
    }
    diffFields(next.name, prev.fields, next.fields, names, ops);
    diffInvariants(
      next.name,
      next.id,
      prev.invariants ?? [],
      next.invariants ?? [],
      ops,
    );
  }

  return { operations: ops };
}

const SEVERITY: Record<Compatibility, number> = {
  Breaking: 0,
  Additive: 1,
  Cosmetic: 2,
};

/** Count operations by compatibility. */
export function summarize(changeset: Changeset): Record<Compatibility, number> {
  const counts: Record<Compatibility, number> = {
    Additive: 0,
    Breaking: 0,
    Cosmetic: 0,
  };
  for (const op of changeset.operations) counts[op.compat] += 1;
  return counts;
}

/** A one-line, human-readable description of a single operation. */
export function describeOperation(op: Operation): string {
  switch (op.kind) {
    case "AddEntity":
      return `Add ${op.entityKind} ${op.entity}`;
    case "RemoveEntity":
      return `Remove ${op.entity}`;
    case "RenameEntity":
      return `Rename ${op.entity} to ${op.to}`;
    case "ChangeEntityKind":
      return `Change ${op.entity} from ${op.from} to ${op.to}`;
    case "MoveEntity":
      return `Move ${op.entity} from ${op.from} to ${op.to}`;
    case "AddField":
      return `Add ${op.entity}.${op.field}: ${op.type}`;
    case "RemoveField":
      return `Remove ${op.entity}.${op.field}`;
    case "RenameField":
      return `Rename ${op.entity}.${op.field} to ${op.to}`;
    case "RetypeField":
      return `Retype ${op.entity}.${op.field}: ${op.from} to ${op.to}`;
    case "ChangeFieldOptionality":
      return `Make ${op.entity}.${op.field} ${op.optional ? "optional" : "required"}`;
    case "ChangeFieldArity":
      return `Make ${op.entity}.${op.field} ${op.collection ? "a collection" : "single"}`;
    case "ChangeFieldRole":
      return `Change ${op.entity}.${op.field} role from ${op.from} to ${op.to}`;
    case "AddInvariant":
      return `Add invariant on ${op.entity}: ${op.text}`;
    case "RemoveInvariant":
      return `Remove invariant on ${op.entity}: ${op.text}`;
  }
}

/** Render a changeset as Markdown, grouped by compatibility, breaking first. */
export function formatChangeset(changeset: Changeset): string {
  const counts = summarize(changeset);
  const total = changeset.operations.length;
  if (total === 0) return "No changes.";

  const header = `${total} change${total === 1 ? "" : "s"} (${counts.Breaking} breaking, ${counts.Additive} additive, ${counts.Cosmetic} cosmetic)`;
  const groups: Compatibility[] = ["Breaking", "Additive", "Cosmetic"];
  const lines = [header];

  for (const group of groups) {
    const ops = changeset.operations.filter((op) => op.compat === group);
    if (ops.length === 0) continue;
    lines.push("", `### ${group}`);
    for (const op of ops) lines.push(`- ${describeOperation(op)}`);
  }

  return lines.join("\n");
}

/** Sort operations breaking-first; stable within a compatibility group. */
export function bySeverity(
  operations: readonly Operation[],
): readonly Operation[] {
  return [...operations].sort(
    (a, b) => SEVERITY[a.compat] - SEVERITY[b.compat],
  );
}
