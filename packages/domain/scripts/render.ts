/**
 * Regenerate `docs/domain-model.md` from Lontra's domain model. Run with
 * `bun run render` inside this package, or `just render-domain` from the root.
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

const output = new URL("../../../docs/domain-model.md", import.meta.url);
const markdown = `# Lontra Domain Model

<!-- Generated from \`packages/domain\`. Run \`just render-domain\` to update. -->

The product, dogfooded: this is Lontra's own domain expressed in its own
meta-model, and it documents the scoping decisions behind the planner. The graph
is a projection of the schema — every edge is derived from a reference or
containment field — so the diagram and the types can never disagree.

\`\`\`mermaid
${toMermaid(lontra)}
\`\`\`
`;

await Bun.write(output, markdown);
console.log(`Wrote ${output.pathname}`);
