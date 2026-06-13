/**
 * Regenerate `docs/domain-model-diff-example.md`: an example review showing a
 * changeset both as text and as an overlaid, color-coded graph. Run with
 * `bun run render-diff` in this package, or `just render-domain-diff` from root.
 *
 * The "after" model is built by mutating a clone of Lontra's own model, so the
 * example stays in sync with the real meta-model.
 */

import { diff, formatChangeset } from "../src/diff.ts";
import { lontra } from "../src/lontra.ts";
import { type DomainModel, validate } from "../src/model.ts";
import { toMermaidDiff } from "../src/mermaid.ts";

type Mutable<T> = T extends object
  ? { -readonly [K in keyof T]: Mutable<T[K]> }
  : T;

// Cast to the loose DomainModel (not lontra's literal type) so pushing a field
// isn't constrained to the exact field shapes already present in the model.
const after = structuredClone(lontra) as unknown as Mutable<DomainModel>;
const find = (id: string) => {
  const entity = after.entities.find((e) => e.id === id);
  if (entity === undefined) throw new Error(`unknown entity: ${id}`);
  return entity;
};

// A reviewer-assignment change a planning agent might propose.
find("session").fields.push({
  id: "session.priority",
  name: "priority",
  type: { kind: "Scalar", name: "Priority" },
  optional: true,
});
find("feature-request").fields = find("feature-request").fields.map((field) =>
  field.id === "feature-request.prompt"
    ? { ...field, type: { kind: "Scalar", name: "RichText" } }
    : field,
);
find("clarification").name = "ClarificationRound";
find("provenance").fields = find("provenance").fields.filter(
  (field) => field.id !== "provenance.derivedFrom",
);
after.entities.push({
  id: "reviewer",
  name: "Reviewer",
  kind: "ValueObject",
  context: "artifact",
  fields: [
    {
      id: "reviewer.name",
      name: "name",
      type: { kind: "Scalar", name: "string" },
    },
  ],
});
find("artifact").fields.push({
  id: "artifact.reviewer",
  name: "reviewer",
  type: { kind: "Reference", target: "reviewer" },
  optional: true,
});
find("artifact").invariants = [
  ...(find("artifact").invariants ?? []),
  "An Artifact must have a Reviewer before it is Approved",
];

for (const problems of [validate(lontra), validate(after)]) {
  if (problems.length > 0) {
    console.error("Refusing to render an inconsistent model:");
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exit(1);
  }
}

const output = new URL(
  "../../../docs/domain-model-diff-example.md",
  import.meta.url,
);
const markdown = `# Lontra Domain Model Diff (Example)

<!-- Generated from \`packages/domain\`. Run \`just render-domain-diff\` to update. -->

An example review: the changeset a planning agent might propose against Lontra's
own model, shown two ways. Each operation is classified so a reviewer's eye goes
to the breaking changes first. The graph overlays both versions — added nodes
are green, removed red, modified amber — and field and edge changes are marked
\`+\` (added), \`-\` (removed), and \`~\` (changed).

## Changeset

${formatChangeset(diff(lontra, after))}

## Diagram

\`\`\`mermaid
${toMermaidDiff(lontra, after)}
\`\`\`
`;

await Bun.write(output, markdown);
console.log(`Wrote ${output.pathname}`);
