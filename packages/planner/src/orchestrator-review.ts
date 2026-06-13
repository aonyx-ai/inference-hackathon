import { Agent } from "@mastra/core/agent";
import { z } from "zod";

import { orchestratorModel } from "./models.ts";

/**
 * The orchestrator's reactive side. The conversational orchestrator scopes the
 * goal up front; this is the same mind in a different mode: when one artifact
 * agent edits its surface, the reviewer looks across the deck and decides
 * whether the change ripples — whether another surface is now inconsistent or
 * incomplete and its agent should revisit it. It does not edit anything itself;
 * it narrates what it sees and hands targeted instructions back to the agents
 * that own the affected artifacts.
 */
const INSTRUCTIONS = `
You are the orchestrator of a tool that scopes agentic coding work across three
surfaces — architecture, the domain model, and user experience. Each surface is
an artifact owned by its own agent. The developer has just had one agent change
its artifact, and your job is to keep the surfaces coherent with each other.

You will receive the goal, a summary of the change that just happened, and the
other artifacts as they stand now. Decide whether the change forces any of the
other artifacts to move. Direct a rethink only when there is a real cross-surface
implication — a new entity that needs a component to own it, a new component that
implies a screen, a removed concept that leaves another surface dangling. Do not
direct busywork: when a change is self-contained, say so and direct nothing.

Refer to the other artifacts only by the ids you are given. For each one that
must move, write a direct instruction to its agent: what to reconsider and why,
grounded in the specific change. Keep your note to the developer to a sentence or
two, in plain prose, describing what the change means across surfaces.
`.trim();

/** A dedicated agent for the structured review; surfaced in the UI as the orchestrator. */
export const orchestratorReviewer = new Agent({
  id: "orchestratorReviewer",
  name: "Orchestrator",
  instructions: INSTRUCTIONS,
  model: orchestratorModel(),
});

/** A directive aimed at one other artifact's agent. */
const directiveSchema = z.object({
  artifactId: z
    .string()
    .describe(
      "The id of the artifact to revisit, exactly as given in the list.",
    ),
  instruction: z
    .string()
    .describe(
      "A direct instruction to that artifact's agent: what to reconsider and " +
        "why, grounded in the change that just happened.",
    ),
});

/** What the reviewer returns: a note for the developer and zero or more directives. */
export const reviewSchema = z.object({
  note: z
    .string()
    .describe(
      "One or two sentences for the developer, in the orchestrator's voice, on " +
        "what the change means across surfaces. If nothing else needs to move, " +
        "say so briefly.",
    ),
  directives: z
    .array(directiveSchema)
    .describe(
      "Only the artifacts that genuinely must change because of this. Empty " +
        "when the change is self-contained.",
    ),
});

export type Review = z.infer<typeof reviewSchema>;

/** One artifact as the reviewer sees it: enough to reason about, not the full body. */
export interface ReviewArtifact {
  id: string;
  kind: string;
  title: string;
  summary: string;
  /** A compact rendering of the artifact's current nodes and edges. */
  digest: string;
}

export interface ReviewInput {
  goal: string;
  /** The artifact that just changed, with a description of what changed. */
  changed: ReviewArtifact & { changeSummary: string };
  /** The other artifacts that could be affected, each with an editing agent. */
  others: ReviewArtifact[];
}

function renderArtifact(artifact: ReviewArtifact): string {
  return [
    `- id: ${artifact.id}`,
    `  kind: ${artifact.kind}`,
    `  title: ${artifact.title}`,
    `  summary: ${artifact.summary}`,
    `  current state: ${artifact.digest}`,
  ].join("\n");
}

/**
 * Ask the orchestrator to review a change and decide what, if anything, it forces
 * elsewhere. Returns the note to show the developer and the directives to fan out
 * to the other artifact agents.
 */
export async function reviewArtifactChange(
  input: ReviewInput,
): Promise<Review> {
  const others =
    input.others.length > 0
      ? input.others.map(renderArtifact).join("\n\n")
      : "(no other artifacts with an agent yet)";

  const content = `
The goal: ${input.goal}

The ${input.changed.kind} artifact ("${input.changed.title}", id ${input.changed.id}) just changed.
What changed: ${input.changed.changeSummary}
Its current state: ${input.changed.digest}

The other artifacts you can direct:

${others}

Review the change and decide which other artifacts, if any, must move because of it.
`.trim();

  const result = await orchestratorReviewer.generate(
    [{ role: "user", content }],
    { structuredOutput: { schema: reviewSchema } },
  );
  return result.object;
}
