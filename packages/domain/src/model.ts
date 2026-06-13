/**
 * The meta-model: the vocabulary Lontra uses to describe any domain model.
 *
 * A domain model is a graph. The macro level is entities (nodes) grouped into
 * bounded contexts; the micro level is the fields inside each entity. Crucially,
 * the graph is a *projection* of the fields: a field whose type points at
 * another entity is what produces an edge. There is one source of truth — the
 * entities and their fields — and {@link deriveEdges} renders the relationships
 * from it. That is also why every node, edge, and field carries a stable id: it
 * lets a diff report a rename as a modify instead of a delete-plus-add.
 */

/** Stable identity for a node (entity), kept distinct from its display name. */
export type NodeId = string;
/** Stable identity for a field, so a rename stays a modify across a diff. */
export type FieldId = string;
/** Stable identity for a derived edge. */
export type EdgeId = string;
/** Stable identity for a bounded context. */
export type ContextId = string;

/** The DDD building block an entity represents. */
export type NodeKind =
  | "AggregateRoot"
  | "Entity"
  | "ValueObject"
  | "DomainEvent";

/** How one entity relates to another. Edges are derived from field types. */
export type EdgeKind = "Contains" | "ReferencesById" | "Association";

/** Multiplicity on the target side of an edge. */
export type Cardinality = "1" | "0..1" | "*";

/** Whether a field is part of the entity's identity. */
export type FieldRole = "Identity" | "Normal";

/**
 * A field's type. The variant decides whether the field stays inside the node
 * or projects to an edge:
 * - `Scalar` is internal (a primitive or named enum), no edge.
 * - `Contains` is composition (a value object or a locally-owned entity) and
 *   projects to a {@link EdgeKind} `Contains` edge.
 * - `Reference` is a by-id reference across an aggregate boundary and projects
 *   to a `ReferencesById` edge.
 */
export type TypeRef =
  | { readonly kind: "Scalar"; readonly name: string }
  | { readonly kind: "Contains"; readonly target: NodeId }
  | { readonly kind: "Reference"; readonly target: NodeId };

/** A single field on an entity. */
export interface Field {
  readonly id: FieldId;
  readonly name: string;
  readonly type: TypeRef;
  /** A collection of the type, e.g. `T[]`. */
  readonly collection?: boolean;
  readonly optional?: boolean;
  readonly role?: FieldRole;
}

/** A node in the graph: one concept in the ubiquitous language. */
export interface DomainEntity {
  readonly id: NodeId;
  readonly name: string;
  readonly kind: NodeKind;
  readonly context: ContextId;
  /** The entity this one specializes, drawn as an inheritance edge. */
  readonly extends?: NodeId;
  readonly fields: readonly Field[];
  /** Business rules that must always hold, surfaced as notes. */
  readonly invariants?: readonly string[];
}

/** A grouping that scopes the ubiquitous language; the same word can differ across contexts. */
export interface BoundedContext {
  readonly id: ContextId;
  readonly name: string;
}

/** A whole domain model: the contexts and the entities within them. */
export interface DomainModel {
  readonly contexts: readonly BoundedContext[];
  readonly entities: readonly DomainEntity[];
}

/** An edge between two entities, derived from a field or an `extends`. */
export interface Edge {
  readonly id: EdgeId;
  readonly from: NodeId;
  readonly to: NodeId;
  readonly kind: EdgeKind | "Inheritance";
  /** The field that produced the edge, used as its label. */
  readonly label?: string;
  readonly cardinality?: Cardinality;
}

function cardinalityOf(field: Field): Cardinality {
  if (field.collection) return "*";
  if (field.optional) return "0..1";
  return "1";
}

/**
 * Project the graph's edges from the entities' fields and `extends` links. This
 * is the heart of the "graph is a projection of the schema" principle: there is
 * no separate edge list to keep in sync, so a field change and the relationship
 * it implies can never disagree.
 */
export function deriveEdges(model: DomainModel): readonly Edge[] {
  const edges: Edge[] = [];
  for (const entity of model.entities) {
    if (entity.extends !== undefined) {
      edges.push({
        id: `${entity.extends}<|-${entity.id}`,
        from: entity.extends,
        to: entity.id,
        kind: "Inheritance",
      });
    }
    for (const field of entity.fields) {
      if (field.type.kind === "Scalar") continue;
      edges.push({
        id: `${entity.id}.${field.id}`,
        from: entity.id,
        to: field.type.target,
        kind: field.type.kind === "Contains" ? "Contains" : "ReferencesById",
        label: field.name,
        cardinality: cardinalityOf(field),
      });
    }
  }
  return edges;
}

/**
 * Check the model is internally consistent: ids are unique and every field and
 * `extends` points at an entity that exists. Returns a list of problems, empty
 * when the model is sound.
 */
export function validate(model: DomainModel): readonly string[] {
  const problems: string[] = [];
  const contextIds = new Set(model.contexts.map((c) => c.id));
  const nodeIds = new Set<NodeId>();

  for (const entity of model.entities) {
    if (nodeIds.has(entity.id))
      problems.push(`duplicate entity id: ${entity.id}`);
    nodeIds.add(entity.id);
    if (!contextIds.has(entity.context)) {
      problems.push(`${entity.id} is in unknown context: ${entity.context}`);
    }
  }

  for (const entity of model.entities) {
    if (entity.extends !== undefined && !nodeIds.has(entity.extends)) {
      problems.push(`${entity.id} extends unknown entity: ${entity.extends}`);
    }
    const fieldIds = new Set<FieldId>();
    for (const field of entity.fields) {
      if (fieldIds.has(field.id)) {
        problems.push(`${entity.id} has duplicate field id: ${field.id}`);
      }
      fieldIds.add(field.id);
      if (field.type.kind !== "Scalar" && !nodeIds.has(field.type.target)) {
        problems.push(
          `${entity.id}.${field.name} points at unknown entity: ${field.type.target}`,
        );
      }
    }
  }

  return problems;
}
