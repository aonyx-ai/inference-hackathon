import { Agent } from "@mastra/core/agent";
import { z } from "zod";

import { artifactAgentModel } from "./models.ts";

export { withModelContext } from "./graph-context.ts";

/**
 * The domain-model artifact agent. Where the orchestrator reasons across all
 * three surfaces, this agent owns a single artifact: the domain model, a graph
 * of entities grouped into bounded contexts, where the fields are the source of
 * truth and the relationships are projected from them. The developer chats with
 * it on the artifact screen and it edits the model in place; the deck overlays
 * the result on the codebase baseline, so the change colors itself.
 */
const INSTRUCTIONS = `
You are the domain-model agent. You own one artifact: a domain model expressed in
a small meta-model. A model is a set of bounded contexts and the entities within
them. Each entity has a DDD kind, a list of fields, and optional invariants. A
field's type is the source of truth for the graph's edges:
  - A Scalar type (a primitive or named enum, e.g. "string", "Timestamp",
    "SessionStatus") stays inside the entity.
  - A Contains type points at another entity the entity owns by value.
  - A Reference type points at another entity by id, across an aggregate
    boundary.

The developer chats with you to evolve this model. On each turn you receive the
current model as JSON and a request. Return the complete updated model — every
context, entity, and field, not just the delta — together with a short reply.

Reuse the stable ids from the model you were given for everything you carry over,
and keep them stable across turns. That is how a rename surfaces as a single
modify rather than a delete plus an add, and how the deck colors the diff. Mint a
new id only for something genuinely new; an entity id is a short slug (e.g.
"comment"), a field id is "<entityId>.<fieldName>" (e.g. "task.comments").

Mark one field per entity with the "Identity" role to denote its key. Only make
the changes the developer asked for; don't redesign the model unprompted. Keep
your reply to a sentence or two describing what you changed and why.

Sometimes a request — often one the orchestrator relays after another surface
moved — turns on a decision only the developer can make: a real fork that would
change the model, not a detail you can reasonably assume. When that happens, make
your best-guess change anyway and set "raise" to a single crisp question asking
the developer to settle it. Leave "raise" empty whenever you can proceed without
asking; do not invent questions.
`.trim();

export const domainAgent = new Agent({
  id: "domain",
  name: "Domain Model",
  instructions: INSTRUCTIONS,
  model: artifactAgentModel(),
});

const typeRefSchema = z
  .discriminatedUnion("kind", [
    z.object({
      kind: z.literal("Scalar"),
      name: z
        .string()
        .describe("A primitive or named enum, e.g. string or SessionStatus."),
    }),
    z.object({
      kind: z.literal("Contains"),
      target: z.string().describe("id of the entity owned by value."),
    }),
    z.object({
      kind: z.literal("Reference"),
      target: z.string().describe("id of the entity referenced by id."),
    }),
  ])
  .describe("A field's type; Contains and Reference project to edges.");

const fieldSchema = z.object({
  id: z
    .string()
    .describe('Stable id, "<entityId>.<fieldName>", reused across turns.'),
  name: z.string().describe("The field name shown on the entity."),
  type: typeRefSchema,
  collection: z
    .boolean()
    .optional()
    .describe("True for a collection, e.g. T[]."),
  optional: z
    .boolean()
    .optional()
    .describe("True when the field may be absent."),
  role: z
    .enum(["Identity", "Normal"])
    .optional()
    .describe(
      "The Identity role marks the entity key; everything else is Normal.",
    ),
});

const entitySchema = z.object({
  id: z
    .string()
    .describe("Stable identifier, a short slug, reused across turns."),
  name: z.string().describe("The entity name shown in the graph."),
  kind: z
    .enum(["AggregateRoot", "Entity", "ValueObject", "DomainEvent"])
    .describe("The DDD building block the entity represents."),
  context: z
    .string()
    .describe("id of the bounded context the entity belongs to."),
  extends: z
    .string()
    .optional()
    .describe("id of the entity this one specializes, drawn as inheritance."),
  fields: z.array(fieldSchema),
  invariants: z
    .array(z.string())
    .optional()
    .describe("Business rules that must always hold, surfaced as notes."),
});

const modelSchema = z.object({
  contexts: z
    .array(z.object({ id: z.string(), name: z.string() }))
    .describe("The bounded contexts that scope the ubiquitous language."),
  entities: z.array(entitySchema),
});

/**
 * What the agent returns each turn: a chat reply plus the full updated model.
 * The server validates the model and hands it back to the frontend as the
 * artifact's new model, which the deck overlays on the codebase baseline.
 */
export const domainEditSchema = z.object({
  reply: z
    .string()
    .describe("A sentence or two for the developer about what changed."),
  model: modelSchema,
  raise: z
    .string()
    .optional()
    .describe(
      "A single question for the developer when the change turns on a decision " +
        "only they can make. Omit when you can proceed without asking.",
    ),
});

export type DomainEdit = z.infer<typeof domainEditSchema>;
