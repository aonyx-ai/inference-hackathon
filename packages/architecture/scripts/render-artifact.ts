/**
 * Regenerate `docs/architecture.mmd`: the repo's real package-dependency graph
 * as a Mermaid flowchart. This is the artifact the planner reads from disk — it
 * parses the flowchart into a graph the deck renders and the architecture agent
 * edits. It is derived from the actual workspace manifests, the same model the
 * rules check, kept as one source of truth. Run with `bun run render-artifact`
 * here, or `just render-architecture-artifact` from the root.
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { toMermaidArchitecture } from "../src/mermaid.ts";
import { type Manifest, toArchitecture } from "../src/workspace.ts";

const repoRoot = new URL("../../../", import.meta.url);

async function readManifests(): Promise<Manifest[]> {
  const manifests: Manifest[] = [];
  for (const group of ["packages", "apps"]) {
    const dir = new URL(`${group}/`, repoRoot);
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      continue;
    }
    for (const name of entries.sort()) {
      let raw: string;
      try {
        raw = await readFile(join(dir.pathname, name, "package.json"), "utf8");
      } catch {
        continue;
      }
      const pkg = JSON.parse(raw) as {
        name?: string;
        dependencies?: Record<string, string>;
      };
      if (!pkg.name) continue;
      manifests.push({
        id: name,
        name: pkg.name,
        dependencies: pkg.dependencies ?? {},
      });
    }
  }
  return manifests;
}

const architecture = toArchitecture(await readManifests());
const output = new URL("../../../docs/architecture.mmd", import.meta.url);
await Bun.write(output, `${toMermaidArchitecture(architecture)}\n`);
console.log(`Wrote ${output.pathname}`);
