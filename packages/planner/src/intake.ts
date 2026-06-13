import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";

/**
 * Stub clarifying questions. In the real planner these come from an orchestrator
 * agent that decides, each round, whether it understands the goal well enough to
 * stop asking. Keeping them static lets the spike prove the suspend/resume
 * backbone without a model or an API key.
 */
const QUESTIONS = [
  "What problem should this change solve for the user?",
  "Are there existing systems or constraints it must fit into?",
] as const;

const ClarifyState = z.object({
  prompt: z.string(),
  answers: z.array(z.string()),
  goalClear: z.boolean(),
});

/**
 * One round of the clarify loop. On a fresh entry it asks the next open question
 * by suspending; on resume it records the answer. The loop repeats until every
 * question is answered.
 */
const clarify = createStep({
  id: "clarify",
  inputSchema: ClarifyState,
  outputSchema: ClarifyState,
  suspendSchema: z.object({ question: z.string() }),
  resumeSchema: z.object({ answer: z.string() }),
  execute: async ({ inputData, resumeData, suspend }) => {
    const answers = resumeData
      ? [...inputData.answers, resumeData.answer]
      : inputData.answers;

    if (answers.length >= QUESTIONS.length) {
      return { ...inputData, answers, goalClear: true };
    }
    if (!resumeData) {
      return await suspend({ question: QUESTIONS[answers.length]! });
    }
    return { ...inputData, answers, goalClear: false };
  },
});

/**
 * The intake half of the planning workflow: take a prompt, clarify the goal over
 * one or more suspend/resume rounds, and return the collected answers. The fan-out
 * to specialist agents will hang off the end of this once the backbone is proven.
 */
export const intakeWorkflow = createWorkflow({
  id: "intake",
  inputSchema: z.object({ prompt: z.string() }),
  outputSchema: z.object({
    prompt: z.string(),
    answers: z.array(z.string()),
  }),
})
  .map(async ({ inputData }) => ({
    prompt: (inputData as { prompt: string }).prompt,
    answers: [] as string[],
    goalClear: false,
  }))
  .dountil(clarify, async ({ inputData }) => inputData.goalClear)
  .map(async ({ inputData }) => ({
    prompt: inputData.prompt,
    answers: inputData.answers,
  }))
  .commit();
