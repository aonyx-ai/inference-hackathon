import { Agent } from "@mastra/core/agent";
import { z } from "zod";

import { orchestratorModel } from "./models.ts";

/**
 * The structured shape the architecture modeler returns. Like the domain
 * artifact it mirrors a graph body, but the nodes are the components a change
 * touches — services, packages, modules, stores — grouped by the layer they sit
 * in, and the edges are the data flow and dependencies between them. The server
 * stamps on layout and change markers; this stays free of presentation.
 */
export const ArchitectureArtifactSchema = z.object({
  title: z
    .string()
    .describe(
      "A short noun phrase naming the architecture change, in title case",
    ),
  summary: z
    .string()
    .describe("One sentence describing what the architecture gains or changes"),
  nodes: z
    .array(
      z.object({
        id: z.string().describe("A stable lowercase identifier with no spaces"),
        label: z.string().describe("The component name, e.g. ExportWorker"),
        group: z
          .string()
          .describe(
            "The layer the component sits in, e.g. frontend, api, worker, or data",
          ),
      }),
    )
    .min(2)
    .describe("The components the change introduces or touches"),
  edges: z
    .array(
      z.object({
        from: z.string().describe("The source component's id"),
        to: z.string().describe("The target component's id"),
        label: z
          .string()
          .describe("The data flow or dependency, e.g. calls, reads, or emits"),
      }),
    )
    .describe("Data flow and dependencies between the components, by node id"),
});

export type ArchitectureArtifactOutput = z.infer<
  typeof ArchitectureArtifactSchema
>;

const INSTRUCTIONS = `
You are the architecture specialist in a tool that scopes agentic coding work.
Given the task a developer wants to accomplish, map the architecture it touches
as a small graph of components and the data flow between them.

Identify the services, packages, modules, controllers, and stores the change
adds or alters, and how requests and data move between them. Put every component
in a layer with its group — for example frontend, api, worker, or data — so the
map reads as a stack. Prefer a handful of meaningful components over an
exhaustive list: this is a plan to read at a glance, not a deployment diagram.
Use the names a developer would recognize from the codebase. Every edge must
connect two components you listed.
`.trim();

/** The agent that turns a task into an architecture-map graph. */
export const architectureModeler = new Agent({
  id: "architectureModeler",
  name: "Architecture Modeler",
  instructions: INSTRUCTIONS,
  model: orchestratorModel(),
});

/**
 * Map the architecture a task touches and return the graph as structured data.
 * When the repo-research stage has run, its architecture findings are passed as
 * `context` so the map is grounded in the components already in the codebase
 * rather than invented from the prompt alone.
 */
export async function generateArchitectureArtifact(
  goal: string,
  context?: string,
): Promise<ArchitectureArtifactOutput> {
  const content = context
    ? `${context}\n\nThe requested change:\n${goal}`
    : goal;
  const result = await architectureModeler.generate(
    [{ role: "user", content }],
    { structuredOutput: { schema: ArchitectureArtifactSchema } },
  );
  return result.object;
}
