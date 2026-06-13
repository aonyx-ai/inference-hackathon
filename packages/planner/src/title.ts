import { Agent } from "@mastra/core/agent";
import { z } from "zod";

import { orchestratorModel } from "./models.ts";

/**
 * The structured shape the task namer returns: a single short title that
 * summarizes the developer's opening prompt for the task header. The opening
 * prompt is often a rambling, first-person description, so the namer distills it
 * down to something scannable.
 */
export const TaskTitleSchema = z.object({
  title: z
    .string()
    .describe(
      "A concise title naming the change, at most about eight words, in " +
        "sentence case with no trailing punctuation",
    ),
});

export type TaskTitleOutput = z.infer<typeof TaskTitleSchema>;

const INSTRUCTIONS = `
You name tasks in a tool that scopes agentic coding work. Given a developer's
opening prompt — often a rambling, first-person description of a change they
want — distill it into a short, scannable title for the task header.

Write the title the way a good commit subject or issue title reads, naming the
change itself (for example: "Export dashboards as PDFs" or "Run data exports as
background jobs"). Keep it under about eight words, drop filler and first-person
framing, use sentence case, and never end with a period. Capture the essential
change, not every detail.
`.trim();

/** The agent that distills an opening prompt into a task title. */
export const taskNamer = new Agent({
  id: "taskNamer",
  name: "Task Namer",
  instructions: INSTRUCTIONS,
  model: orchestratorModel(),
});

/** Summarize an opening prompt into a short task title. */
export async function generateTaskTitle(prompt: string): Promise<string> {
  const result = await taskNamer.generate([{ role: "user", content: prompt }], {
    structuredOutput: { schema: TaskTitleSchema },
  });
  return result.object.title;
}
