import { expect, test } from "bun:test";

import { mastra } from "./mastra.ts";

test("intake clarifies the goal through suspend/resume rounds", async () => {
  const run = await mastra.getWorkflow("intake").createRun();

  let result = await run.start({
    inputData: { prompt: "Add billing to the app" },
  });

  const asked: string[] = [];
  let guard = 0;
  while (result.status === "suspended" && guard++ < 10) {
    const question = (
      result.steps.clarify?.suspendPayload as { question: string } | undefined
    )?.question;
    expect(typeof question).toBe("string");
    asked.push(question as string);
    result = await run.resume({
      step: "clarify",
      resumeData: { answer: `answer ${asked.length}` },
    });
  }

  expect(result.status).toBe("success");
  expect(asked).toHaveLength(2);
  if (result.status === "success") {
    const output = result.result as { answers: string[] };
    expect(output.answers).toEqual(["answer 1", "answer 2"]);
  }
});
