import { Agent } from "@mastra/core/agent";
import { z } from "zod";

import { orchestratorModel } from "./models.ts";

/**
 * The structured shape the domain modeler returns. It mirrors a graph artifact's
 * body (entities as nodes, relationships as edges) plus a title and summary for
 * the card, but stays free of presentational concerns like layout or change
 * markers — the server stamps those on.
 */
export const DomainArtifactSchema = z.object({
  title: z
    .string()
    .describe("A short noun phrase naming the domain change, in title case"),
  summary: z
    .string()
    .describe("One sentence describing what the domain model gains or changes"),
  nodes: z
    .array(
      z.object({
        id: z.string().describe("A stable lowercase identifier with no spaces"),
        label: z.string().describe("The entity name, e.g. ExportJob"),
      }),
    )
    .min(2)
    .describe("The domain entities the change introduces or touches"),
  edges: z
    .array(
      z.object({
        from: z.string().describe("The source entity's id"),
        to: z.string().describe("The target entity's id"),
        label: z
          .string()
          .describe("The relationship, e.g. owns, has, or requests"),
      }),
    )
    .describe("Relationships between the entities, by node id"),
});

export type DomainArtifactOutput = z.infer<typeof DomainArtifactSchema>;

const INSTRUCTIONS = `
You are the domain-model specialist in a tool that scopes agentic coding work.
Given the task a developer wants to accomplish, model the domain it touches as a
small graph of entities and the relationships between them.

Identify the entities (aggregates, entities, and value objects) the change adds
or alters, and the relationships among them. Prefer a handful of meaningful
entities over an exhaustive list — this is a plan to read at a glance, not a full
schema. Use the names a developer would recognize from the codebase or naturally
reach for. Every edge must connect two entities you listed.
`.trim();

/** The agent that turns a task into a domain-model graph. */
export const domainModeler = new Agent({
  id: "domainModeler",
  name: "Domain Modeler",
  instructions: INSTRUCTIONS,
  model: orchestratorModel(),
});

/**
 * Model the domain a task touches and return the graph as structured data. When
 * the repo-research stage has run, its domain findings are passed as `context`
 * so the graph is grounded in the entities already in the codebase rather than
 * invented from the prompt alone.
 */
export async function generateDomainArtifact(
  goal: string,
  context?: string,
): Promise<DomainArtifactOutput> {
  const content = context
    ? `${context}\n\nThe requested change:\n${goal}`
    : goal;
  const result = await domainModeler.generate([{ role: "user", content }], {
    structuredOutput: { schema: DomainArtifactSchema },
  });
  return result.object;
}
