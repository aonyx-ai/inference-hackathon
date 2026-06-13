/**
 * Regenerate `docs/domain.json`: Lontra's own domain model serialized as the
 * structured {@link DomainModel}. This is the artifact the planner reads from
 * disk — it loads the model directly and renders it as Mermaid, so the diagram
 * keeps every field, stereotype, and invariant instead of a parsed-back graph.
 * Run with `bun run render-artifact` here, or `just render-domain-artifact`.
 */

import { lontra } from "../src/lontra.ts";
import { validate } from "../src/model.ts";

const problems = validate(lontra);
if (problems.length > 0) {
  console.error("Refusing to render an inconsistent model:");
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

const output = new URL("../../../docs/domain.json", import.meta.url);
await Bun.write(output, `${JSON.stringify(lontra, null, 2)}\n`);
console.log(`Wrote ${output.pathname}`);
