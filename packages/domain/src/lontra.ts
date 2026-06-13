/**
 * Lontra's own domain model, expressed in its own meta-model.
 *
 * This is the product dogfooding itself: the artifact that documents the
 * decisions we are making right now *is* a Lontra domain-model artifact. Note
 * the recursion — `DomainEntity`, `Field`, and `Relationship` below are the
 * meta-model, so they describe the very boxes you are looking at.
 *
 * Scope is two bounded contexts, Planning and Artifact. The runtime concepts
 * (the Mastra run, the sidecar, specialists-as-workflow-steps) deliberately
 * live on the Architecture surface, not here; the link between a Session and
 * the run that realizes it is a context mapping, not a shared model.
 */

import type { DomainModel, Field, TypeRef } from "./model.ts";

const scalar = (name: string): TypeRef => ({ kind: "Scalar", name });
const contains = (target: string): TypeRef => ({ kind: "Contains", target });
const ref = (target: string): TypeRef => ({ kind: "Reference", target });

/** Identity field shorthand. */
const id = (entity: string, type: string): Field => ({
  id: `${entity}.id`,
  name: "id",
  type: scalar(type),
  role: "Identity",
});

export const lontra = {
  contexts: [
    { id: "planning", name: "Planning" },
    { id: "artifact", name: "Artifact" },
  ],
  entities: [
    // --- Planning -------------------------------------------------------
    {
      id: "session",
      name: "Session",
      kind: "AggregateRoot",
      context: "planning",
      fields: [
        id("session", "SessionId"),
        {
          id: "session.request",
          name: "request",
          type: contains("feature-request"),
        },
        { id: "session.status", name: "status", type: scalar("SessionStatus") },
        {
          id: "session.clarifications",
          name: "clarifications",
          type: contains("clarification"),
          collection: true,
        },
        {
          id: "session.artifacts",
          name: "artifacts",
          type: ref("artifact"),
          collection: true,
        },
        { id: "session.plan", name: "plan", type: ref("plan"), optional: true },
      ],
      invariants: [
        "Reaches Approved only when all three Artifacts are Approved",
        "Holds exactly one Artifact per surface",
      ],
    },
    {
      id: "feature-request",
      name: "FeatureRequest",
      kind: "ValueObject",
      context: "planning",
      fields: [
        {
          id: "feature-request.prompt",
          name: "prompt",
          type: scalar("string"),
        },
        {
          id: "feature-request.source",
          name: "source",
          type: scalar("RequestSource"),
          optional: true,
        },
        {
          id: "feature-request.submittedAt",
          name: "submittedAt",
          type: scalar("Timestamp"),
        },
      ],
    },
    {
      id: "clarification",
      name: "Clarification",
      kind: "Entity",
      context: "planning",
      fields: [
        { id: "clarification.round", name: "round", type: scalar("int") },
        {
          id: "clarification.question",
          name: "question",
          type: scalar("string"),
        },
        {
          id: "clarification.answer",
          name: "answer",
          type: scalar("string"),
          optional: true,
        },
      ],
    },
    {
      id: "plan",
      name: "Plan",
      kind: "AggregateRoot",
      context: "planning",
      fields: [
        id("plan", "PlanId"),
        { id: "plan.session", name: "session", type: ref("session") },
        {
          id: "plan.artifacts",
          name: "artifacts",
          type: ref("artifact"),
          collection: true,
        },
        {
          id: "plan.renderedMarkdown",
          name: "renderedMarkdown",
          type: scalar("string"),
        },
      ],
      invariants: ["References only Approved Artifacts"],
    },

    // --- Artifact -------------------------------------------------------
    {
      id: "artifact",
      name: "Artifact",
      kind: "AggregateRoot",
      context: "artifact",
      fields: [
        id("artifact", "ArtifactId"),
        { id: "artifact.surface", name: "surface", type: scalar("Surface") },
        { id: "artifact.goal", name: "goal", type: contains("goal") },
        {
          id: "artifact.provenance",
          name: "provenance",
          type: contains("provenance"),
        },
        {
          id: "artifact.status",
          name: "status",
          type: scalar("ArtifactStatus"),
        },
      ],
      invariants: ["A Stale Artifact cannot belong to an approved Plan"],
    },
    {
      id: "goal",
      name: "Goal",
      kind: "ValueObject",
      context: "artifact",
      fields: [
        { id: "goal.statement", name: "statement", type: scalar("string") },
      ],
      invariants: ["The MetaLoop reconciles each Artifact against this"],
    },
    {
      id: "provenance",
      name: "Provenance",
      kind: "ValueObject",
      context: "artifact",
      fields: [
        {
          id: "provenance.producedBy",
          name: "producedBy",
          type: scalar("SpecialistKind"),
        },
        {
          id: "provenance.derivedFrom",
          name: "derivedFrom",
          type: ref("artifact"),
          optional: true,
        },
      ],
    },
    {
      id: "changeset",
      name: "Changeset",
      kind: "ValueObject",
      context: "artifact",
      fields: [
        {
          id: "changeset.operations",
          name: "operations",
          type: contains("operation"),
          collection: true,
        },
      ],
      invariants: ["Equals diff(before, after)"],
    },
    {
      id: "operation",
      name: "Operation",
      kind: "ValueObject",
      context: "artifact",
      fields: [
        { id: "operation.kind", name: "kind", type: scalar("OperationKind") },
        { id: "operation.target", name: "target", type: scalar("StableId") },
        {
          id: "operation.compat",
          name: "compat",
          type: scalar("Compatibility"),
        },
      ],
    },
    {
      id: "artifact-changed",
      name: "ArtifactChanged",
      kind: "DomainEvent",
      context: "artifact",
      fields: [
        {
          id: "artifact-changed.artifact",
          name: "artifact",
          type: ref("artifact"),
        },
      ],
      invariants: ["Published on edit; triggers the MetaLoop"],
    },

    // --- Artifact: the meta-model (a DomainModel artifact's content) -----
    {
      id: "domain-model-artifact",
      name: "DomainModelArtifact",
      kind: "Entity",
      context: "artifact",
      extends: "artifact",
      fields: [
        {
          id: "domain-model-artifact.contexts",
          name: "contexts",
          type: contains("bounded-context"),
          collection: true,
        },
        {
          id: "domain-model-artifact.entities",
          name: "entities",
          type: contains("domain-entity"),
          collection: true,
        },
        {
          id: "domain-model-artifact.relationships",
          name: "relationships",
          type: contains("relationship"),
          collection: true,
        },
      ],
    },
    {
      id: "bounded-context",
      name: "BoundedContext",
      kind: "Entity",
      context: "artifact",
      fields: [
        id("bounded-context", "ContextId"),
        { id: "bounded-context.name", name: "name", type: scalar("string") },
      ],
    },
    {
      id: "domain-entity",
      name: "DomainEntity",
      kind: "Entity",
      context: "artifact",
      fields: [
        id("domain-entity", "NodeId"),
        { id: "domain-entity.name", name: "name", type: scalar("string") },
        { id: "domain-entity.kind", name: "kind", type: scalar("NodeKind") },
        {
          id: "domain-entity.context",
          name: "context",
          type: ref("bounded-context"),
        },
        {
          id: "domain-entity.fields",
          name: "fields",
          type: contains("field"),
          collection: true,
        },
      ],
    },
    {
      id: "field",
      name: "Field",
      kind: "ValueObject",
      context: "artifact",
      fields: [
        id("field", "FieldId"),
        { id: "field.name", name: "name", type: scalar("string") },
        { id: "field.type", name: "type", type: scalar("TypeRef") },
        { id: "field.optional", name: "optional", type: scalar("bool") },
        { id: "field.role", name: "role", type: scalar("FieldRole") },
      ],
      invariants: [
        "A stable id is what makes a rename a modify, not delete-plus-add",
      ],
    },
    {
      id: "relationship",
      name: "Relationship",
      kind: "Entity",
      context: "artifact",
      fields: [
        id("relationship", "EdgeId"),
        { id: "relationship.from", name: "from", type: ref("domain-entity") },
        { id: "relationship.to", name: "to", type: ref("domain-entity") },
        { id: "relationship.kind", name: "kind", type: scalar("EdgeKind") },
        {
          id: "relationship.cardinality",
          name: "cardinality",
          type: scalar("Cardinality"),
        },
      ],
      invariants: ["Projected from the reference and containment fields"],
    },
  ],
} satisfies DomainModel;
