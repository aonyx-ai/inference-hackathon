import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

import { synthesizePlan, type PlanArtifactInput } from "./src/plan.ts";
import { parseMermaidGraph } from "./src/mermaid-graph.ts";

const ARTIFACTS_DIR = resolve(import.meta.dir, "../../docs");

const KIND_TITLES: Record<string, string> = {
  architecture: "Architecture",
  domain: "Domain Model",
  ux: "User Experience",
};

const entries = await readdir(ARTIFACTS_DIR);
const files = entries.filter((n) => n.endsWith(".mmd")).sort();
const onDisk: PlanArtifactInput[] = await Promise.all(
  files.map(async (name) => {
    const diagram = await readFile(join(ARTIFACTS_DIR, name), "utf8");
    const stem = name.slice(0, -".mmd".length);
    const kind = ["architecture", "domain", "ux"].includes(stem)
      ? (stem as PlanArtifactInput["kind"])
      : "domain";
    return {
      kind,
      title: KIND_TITLES[kind] ?? kind,
      summary: "",
      body: { type: "graph", ...parseMermaidGraph(diagram) },
    } as PlanArtifactInput;
  }),
);

console.error(
  "[repro] on-disk artifacts:",
  onDisk.map((a) => `${a.kind} (${a.body.type})`).join(", "),
);

console.error("[repro] calling synthesizePlan...");
const started = performance.now();
const timeout = new Promise((_, reject) =>
  setTimeout(() => reject(new Error("TIMEOUT after 45s")), 45_000),
);
try {
  const plan = await Promise.race([
    synthesizePlan("Add a Share action to the project dashboard.", onDisk),
    timeout,
  ]);
  console.error(`[repro] done in ${Math.round(performance.now() - started)}ms`);
  console.log("OK:", JSON.stringify(plan, null, 2));
} catch (error) {
  console.error(`[repro] failed after ${Math.round(performance.now() - started)}ms`);
  console.error("REPRO ERROR:", error instanceof Error ? error.message : error);
  console.error("STACK:", error instanceof Error ? error.stack : "(no stack)");
}
process.exit(0);
