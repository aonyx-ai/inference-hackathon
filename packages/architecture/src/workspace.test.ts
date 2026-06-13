import { expect, test } from "bun:test";

import { lontraRules } from "./lontra.ts";
import { validate } from "./model.ts";
import { check } from "./rules.ts";
import { type Manifest, toArchitecture } from "./workspace.ts";

// A manifest set shaped like the real workspace, kept here so the rules can be
// exercised without touching the filesystem; scripts/check.ts runs the live one.
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
    },
  },
];

test("workspace deps map to internal and external edges", () => {
  const architecture = toArchitecture(manifests);
  const desktop = architecture.components.find(
    (component) => component.id === "desktop",
  );

  expect(desktop?.dependsOn).toEqual([
    { to: "core", kind: "internal" },
    { to: "react", kind: "external" },
    { to: "@tauri-apps/api", kind: "external" },
  ]);
  expect(validate(architecture)).toEqual([]);
});

test("the real-shaped workspace satisfies every rule", () => {
  const findings = check(toArchitecture(manifests), lontraRules);
  expect(findings.filter((finding) => finding.status === "violated")).toEqual(
    [],
  );
  expect(findings).toHaveLength(lontraRules.length);
});

test("calling the model from the webview is caught as a breaking change", () => {
  const tampered = manifests.map((manifest) =>
    manifest.id === "desktop"
      ? {
          ...manifest,
          dependencies: { ...manifest.dependencies, "@mastra/core": "^1" },
        }
      : manifest,
  );
  const broken = check(toArchitecture(tampered), lontraRules).filter(
    (f) => f.status === "violated",
  );

  expect(broken).toHaveLength(1);
  expect(broken[0]).toMatchObject({
    rule: "mastra-only-in-sidecar",
    edge: { from: "@inference-hackathon/desktop", to: "@mastra/core" },
  });
});
