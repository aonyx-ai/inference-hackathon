/**
 * Regenerate `docs/architecture-review-example.md`: an example architecture
 * review of a proposed change, shown as the classified report and the dependency
 * graph with the offending edge reddened. Run with `bun run render` in this
 * package, or `just render-architecture` from the root.
 *
 * The change modeled is "the desktop webview calls the model directly", which
 * violates the rule confining Mastra to the sidecar.
 */

import { lontraRules } from "../src/lontra.ts";
import { toMermaidArchitecture } from "../src/mermaid.ts";
import { check, formatReport } from "../src/rules.ts";
import { type Manifest, toArchitecture } from "../src/workspace.ts";

const manifests: Manifest[] = [
  { id: "core", name: "@inference-hackathon/core", dependencies: {} },
  { id: "domain", name: "@inference-hackathon/domain", dependencies: {} },
  {
    id: "planner",
    name: "@inference-hackathon/planner",
    dependencies: { "@mastra/core": "^1", "@mastra/libsql": "^1", zod: "^4" },
  },
  {
    id: "desktop",
    name: "@inference-hackathon/desktop",
    dependencies: {
      "@inference-hackathon/core": "workspace:*",
      react: "^19",
      "@tauri-apps/api": "^2",
      // The proposed change: the webview reaches for the model runtime directly.
      "@mastra/core": "^1",
    },
  },
];

const architecture = toArchitecture(manifests);
const findings = check(architecture, lontraRules);

const output = new URL(
  "../../../docs/architecture-review-example.md",
  import.meta.url,
);
const markdown = `# Architecture Review (Example)

<!-- Generated from \`packages/architecture\`. Run \`just render-architecture\` to update. -->

A proposed change — the desktop webview calling the model runtime directly —
checked against Lontra's architectural rules. The report classifies every rule,
and the graph reddens the offending dependency so the violation is visible at a
glance rather than buried in a diff.

## Report

${formatReport(findings)}

## Diagram

\`\`\`mermaid
${toMermaidArchitecture(architecture, findings)}
\`\`\`
`;

await Bun.write(output, markdown);
console.log(`Wrote ${output.pathname}`);
