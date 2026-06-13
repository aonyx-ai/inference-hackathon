import { Agent } from "@mastra/core/agent";
import { z } from "zod";

import { artifactAgentModel } from "./models.ts";

export { withGraphContext } from "./graph-context.ts";

/**
 * The domain-model artifact agent. Where the orchestrator reasons across all
 * three surfaces, this agent owns a single artifact: the domain model, drawn as
 * a diffable graph of entities (nodes) and relationships (edges). The developer
 * chats with it on the artifact screen and it edits the graph in place, marking
 * what it added, removed, or modified so the differ can color the change.
 */
const INSTRUCTIONS = `
You are the domain-model agent. You own one artifact: a domain model drawn as a
graph, where nodes are entities (e.g. User, Order, ExportJob) and edges are the
relationships between them (e.g. "owns", "contains").

The developer chats with you to evolve this model. On each turn you receive the
current model as JSON and a request. Return the complete updated model — every
node and edge, not just the delta — together with a short reply.

Mark every node and edge with how it changed this turn:
  - "added" for entities or relationships you are introducing now.
  - "removed" for ones you are dropping. Keep them in the list, marked removed,
    so the developer can see what left.
  - "modified" for ones whose label or meaning you changed.
  - "unchanged" for everything you carried over untouched.

Use short, conventional entity names and lowercase relationship labels. Only
make the changes the developer asked for; don't redesign the model unprompted.
Keep your reply to a sentence or two describing what you changed and why.

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

const change = z.enum(["added", "removed", "modified", "unchanged"]);

const nodeSchema = z.object({
  id: z.string().describe("Stable identifier, reused across turns."),
  label: z.string().describe("The entity name shown in the graph."),
  group: z
    .string()
    .optional()
    .describe("Optional bounded context the entity belongs to."),
  change,
});

const edgeSchema = z.object({
  from: z.string().describe("id of the source node."),
  to: z.string().describe("id of the target node."),
  label: z.string().optional().describe('The relationship, e.g. "owns".'),
  change,
});

/**
 * What the agent returns each turn: a chat reply plus the full updated graph.
 * The server hands the nodes and edges straight back to the frontend as the
 * artifact's new body, so the differ re-renders with the changes colored.
 */
export const domainEditSchema = z.object({
  reply: z
    .string()
    .describe("A sentence or two for the developer about what changed."),
  nodes: z.array(nodeSchema),
  edges: z.array(edgeSchema),
  raise: z
    .string()
    .optional()
    .describe(
      "A single question for the developer when the change turns on a decision " +
        "only they can make. Omit when you can proceed without asking.",
    ),
});

export type DomainEdit = z.infer<typeof domainEditSchema>;
