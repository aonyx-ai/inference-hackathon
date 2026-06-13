import { Mastra } from "@mastra/core/mastra";
import { LibSQLStore } from "@mastra/libsql";

import { domainAgent } from "./domain-agent.ts";
import { intakeWorkflow } from "./intake.ts";
import { orchestrator } from "./orchestrator.ts";
import { domainModeler } from "./domain.ts";

/**
 * In-memory Mastra instance for the spike. The real app points LibSQLStore at a
 * file in the Tauri app's data directory so suspended runs survive restarts.
 */
export const mastra = new Mastra({
  storage: new LibSQLStore({ id: "planner", url: ":memory:" }),
  workflows: { intake: intakeWorkflow },
  agents: { orchestrator, domainModeler, domain: domainAgent },
});
