/**
 * Regenerate `docs/domain.mmd`: Lontra's own domain model as a Mermaid class
 * diagram. This is the artifact the planner reads from disk — it parses the
 * diagram into a graph the deck renders and the domain agent edits. It is the
 * same `toMermaid` projection the prose docs use, kept as one source of truth.
 * Run with `bun run render-artifact` here, or `just render-domain-artifact`.
 */

import { lontra } from "../src/lontra.ts";
import { toMermaid } from "../src/mermaid.ts";
import { validate } from "../src/model.ts";

const problems = validate(lontra);
if (problems.length > 0) {
  console.error("Refusing to render an inconsistent model:");
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

const output = new URL("../../../docs/domain.mmd", import.meta.url);
await Bun.write(output, `${toMermaid(lontra)}\n`);
console.log(`Wrote ${output.pathname}`);
