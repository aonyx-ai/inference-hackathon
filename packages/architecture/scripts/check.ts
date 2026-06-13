/**
 * Check the live workspace dependency graph against Lontra's architectural
 * rules. Run with `bun run check` in this package, or `just check-arch` from the
 * root. Exits non-zero if any rule is violated, so it can serve as a gate.
 */

import { Glob } from "bun";

import { lontraRules } from "../src/lontra.ts";
import { validate } from "../src/model.ts";
import { check, formatReport, summarize } from "../src/rules.ts";
import { type Manifest, toArchitecture } from "../src/workspace.ts";

const root = new URL("../../../", import.meta.url).pathname;

const manifests: Manifest[] = [];
for (const pattern of ["packages/*/package.json", "apps/*/package.json"]) {
  for await (const relative of new Glob(pattern).scan({ cwd: root })) {
    const json = (await Bun.file(root + relative).json()) as {
      name?: string;
      dependencies?: Record<string, string>;
    };
    const parts = relative.split("/");
    const id = parts[parts.length - 2] ?? relative;
    manifests.push({
      id,
      name: json.name ?? id,
      dependencies: json.dependencies ?? {},
    });
  }
}

const architecture = toArchitecture(manifests);
const problems = validate(architecture);
if (problems.length > 0) {
  console.error("Inconsistent architecture model:");
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

const findings = check(architecture, lontraRules);
console.log(formatReport(findings));
if (summarize(findings).violated > 0) process.exit(1);
