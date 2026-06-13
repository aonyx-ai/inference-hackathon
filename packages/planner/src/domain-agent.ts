import { Agent } from "@mastra/core/agent";
import { z } from "zod";

import { artifactAgentModel } from "./models.ts";

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
});

export type DomainEdit = z.infer<typeof domainEditSchema>;

/** A turn in the provider-agnostic shape the frontend posts. */
interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

interface GraphLike {
  nodes: unknown[];
  edges: unknown[];
}

/**
 * Fold the current graph into the conversation so the agent edits the real
 * model rather than inventing one. The graph rides along with the developer's
 * latest message — prepended to it, or as a fresh turn when there isn't one —
 * which keeps the user/assistant roles alternating for every provider.
 */
export function withGraphContext(
  graph: GraphLike,
  turns: ChatTurn[],
): ChatTurn[] {
  const serialized = JSON.stringify(
    { nodes: graph.nodes, edges: graph.edges },
    null,
    2,
  );
  const preface =
    `Here is the domain model as it stands now, as JSON:\n\n${serialized}\n\n` +
    `Apply the request below and return the complete updated model.`;

  const lastUser = turns.reduce(
    (found, turn, index) => (turn.role === "user" ? index : found),
    -1,
  );
  if (lastUser === -1) {
    return [{ role: "user", content: preface }, ...turns];
  }
  return turns.map((turn, index) =>
    index === lastUser
      ? { ...turn, content: `${preface}\n\n---\n\n${turn.content}` }
      : turn,
  );
}
