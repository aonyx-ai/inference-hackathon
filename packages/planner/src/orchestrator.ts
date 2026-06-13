import { Agent } from "@mastra/core/agent";
import { z } from "zod";

import { orchestratorModel } from "./models.ts";

/**
 * The orchestrator the developer talks to on the home screen. It turns a prompt
 * into scoped work across three surfaces — architecture, the domain model, and
 * user experience — and decides, in conversation, what it still needs to know
 * before it can plan. For the demo it answers in plain prose; the fan-out to the
 * specialist artifact agents hangs off this once the chat backbone is proven.
 */
const INSTRUCTIONS = `
You are the orchestrator in a tool that scopes agentic coding work before any
code is written. A developer describes a change they want; you turn it into a
clear, well-scoped plan.

You reason about three surfaces:
  - Architecture: the services, controllers, and data flow a change touches.
  - Domain model: the entities and relationships it adds or alters.
  - User experience: the screens and interactions it introduces.

Your job in conversation is to build a shared understanding of the goal. Ask
sharp clarifying questions when the request is ambiguous or a real decision is
at stake (for example: synchronous versus queued work, or whether something is a
first-class tracked entity). Ask at most one or two questions at a time, and only
when the answer would actually change the plan. When the goal is clear, briefly
describe how you would scope the work across the three surfaces.

Be concise and direct. Write in plain prose, not bullet-point dumps. You are a
thoughtful technical partner, not a form to fill in.

The developer decides when scoping is done. When they signal they are satisfied
and want to move forward — "looks good", "that's right", "let's go", "ship it",
or anything that plainly means proceed — set readyForPlan to true. That is the
cue to draw the scoped artifacts together into an implementation plan, so keep
your reply short and confirm you are pulling it together. Until then readyForPlan
is false. Never set it on the opening message, and never fish for it; wait for
the developer to land there on their own.
`.trim();

/**
 * What the orchestrator returns each turn: its prose reply plus whether the
 * developer has signaled the scoping is done. When `readyForPlan` flips true the
 * deck synthesizes the plan from the artifacts — there is no button; the
 * orchestrator reads the cue from the conversation.
 */
export const orchestratorReplySchema = z.object({
  reply: z.string().describe("Your message to the developer, in plain prose."),
  readyForPlan: z
    .boolean()
    .describe(
      "True only once the developer has signaled they are satisfied and want to proceed.",
    ),
});

export type OrchestratorReply = z.infer<typeof orchestratorReplySchema>;

export const orchestrator = new Agent({
  id: "orchestrator",
  name: "Orchestrator",
  instructions: INSTRUCTIONS,
  model: orchestratorModel(),
});
