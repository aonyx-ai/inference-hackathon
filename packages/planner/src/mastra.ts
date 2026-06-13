import { Mastra } from "@mastra/core/mastra";
import { LibSQLStore } from "@mastra/libsql";

import { architectureAgent } from "./architecture-agent.ts";
import { architectureModeler } from "./architecture.ts";
import { domainAgent } from "./domain-agent.ts";
import { intakeWorkflow } from "./intake.ts";
import { orchestrator } from "./orchestrator.ts";
import { orchestratorReviewer } from "./orchestrator-review.ts";
import { taskNamer } from "./title.ts";

/**
 * In-memory Mastra instance for the spike. The real app points LibSQLStore at a
 * file in the Tauri app's data directory so suspended runs survive restarts.
 */
export const mastra = new Mastra({
  storage: new LibSQLStore({ id: "planner", url: ":memory:" }),
  workflows: { intake: intakeWorkflow },
  agents: {
    orchestrator,
    orchestratorReviewer,
    domain: domainAgent,
    taskNamer,
    architectureModeler,
    architecture: architectureAgent,
  },
});
