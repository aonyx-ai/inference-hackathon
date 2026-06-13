import { Agent } from "@mastra/core/agent";
import { z } from "zod";

import { artifactAgentModel } from "./models.ts";

/**
 * The architecture artifact agent. Where the orchestrator reasons across all
 * three surfaces, this agent owns a single artifact: the architecture map, drawn
 * as a diffable graph of components (nodes, grouped by layer) and the data flow
 * between them (edges). The developer chats with it on the artifact screen and
 * it edits the graph in place, marking what it added, removed, or modified so
 * the differ can color the change.
 */
const INSTRUCTIONS = `
You are the architecture agent. You own one artifact: an architecture map drawn
as a graph, where nodes are components (e.g. ReportController, ExportWorker,
ReportStore), each in a layer named by its group (e.g. frontend, api, worker,
data), and edges are the data flow or dependencies between them (e.g. "calls",
"reads", "emits").

The developer chats with you to evolve this map. On each turn you receive the
current map as JSON and a request. Return the complete updated map — every node
and edge, not just the delta — together with a short reply.

Mark every node and edge with how it changed this turn:
  - "added" for components or flows you are introducing now.
  - "removed" for ones you are dropping. Keep them in the list, marked removed,
    so the developer can see what left.
  - "modified" for ones whose label, layer, or meaning you changed.
  - "unchanged" for everything you carried over untouched.

Keep components in sensible layers via their group, use short conventional names
and lowercase flow labels. Only make the changes the developer asked for; don't
redesign the architecture unprompted. Keep your reply to a sentence or two
describing what you changed and why.

Sometimes a request — often one the orchestrator relays after another surface
moved — turns on a decision only the developer can make: a real fork that would
change the architecture, such as synchronous versus queued work. When that
happens, make your best-guess change anyway and set "raise" to a single crisp
question asking the developer to settle it. Leave "raise" empty whenever you can
proceed without asking; do not invent questions.
`.trim();

export const architectureAgent = new Agent({
  id: "architecture",
  name: "Architecture",
  instructions: INSTRUCTIONS,
  model: artifactAgentModel(),
});

const change = z.enum(["added", "removed", "modified", "unchanged"]);

const nodeSchema = z.object({
  id: z.string().describe("Stable identifier, reused across turns."),
  label: z.string().describe("The component name shown in the graph."),
  group: z
    .string()
    .optional()
    .describe("The layer the component sits in, e.g. frontend or worker."),
  change,
});

const edgeSchema = z.object({
  from: z.string().describe("id of the source node."),
  to: z.string().describe("id of the target node."),
  label: z.string().optional().describe('The data flow, e.g. "calls".'),
  change,
});

/**
 * What the agent returns each turn: a chat reply plus the full updated graph.
 * The server hands the nodes and edges straight back to the frontend as the
 * artifact's new body, so the differ re-renders with the changes colored.
 */
export const architectureEditSchema = z.object({
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

export type ArchitectureEdit = z.infer<typeof architectureEditSchema>;
