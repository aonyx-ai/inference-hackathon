import { describe, expect, test } from "bun:test";

import type { Architecture, Dependency } from "./model.ts";
import { check, formatReport, type Rule, summarize } from "./rules.ts";

const ext = (to: string): Dependency => ({ to, kind: "external" });
const int = (to: string): Dependency => ({ to, kind: "internal" });
const c = (id: string, deps: Dependency[] = []) => ({
  id,
  name: id,
  dependsOn: deps,
});
const arch = (...components: Architecture["components"]): Architecture => ({
  components,
});

const violations = (a: Architecture, rules: Rule[]) =>
  check(a, rules).filter((finding) => finding.status === "violated");

describe("forbid", () => {
  const rule: Rule = {
    id: "pure-core",
    intent: "core is platform-independent",
    forbid: { from: ["core"], to: { external: "@tauri-apps/*" } },
  };

  test("a forbidden dependency is a violation naming the edge", () => {
    expect(
      violations(arch(c("core", [ext("@tauri-apps/api")])), [rule]),
    ).toMatchObject([
      {
        status: "violated",
        rule: "pure-core",
        edge: { from: "core", to: "@tauri-apps/api" },
      },
    ]);
  });

  test("a component outside the rule's `from` set is unaffected", () => {
    // desktop may depend on Tauri; only core is constrained.
    expect(
      violations(arch(c("desktop", [ext("@tauri-apps/api")])), [rule]),
    ).toEqual([]);
  });

  test("an exact pattern does not over-match a sibling package", () => {
    const noReact: Rule = {
      id: "x",
      intent: "y",
      forbid: { from: ["core"], to: { external: "react" } },
    };
    expect(violations(arch(c("core", [ext("react-dom")])), [noReact])).toEqual(
      [],
    );
  });

  test("each offending edge produces its own finding", () => {
    const both = arch(
      c("core", [ext("@tauri-apps/api"), ext("@tauri-apps/plugin-opener")]),
    );
    expect(violations(both, [rule])).toHaveLength(2);
  });
});

describe("confine", () => {
  const rule: Rule = {
    id: "mastra-only-in-sidecar",
    intent: "Mastra stays in the sidecar",
    confine: { to: { external: "@mastra/*" }, allowedFrom: ["planner"] },
  };

  test("an allowed importer is fine, a disallowed one violates", () => {
    const a = arch(
      c("planner", [ext("@mastra/core")]),
      c("desktop", [ext("@mastra/core")]),
    );
    expect(violations(a, [rule])).toMatchObject([
      {
        rule: "mastra-only-in-sidecar",
        edge: { from: "desktop", to: "@mastra/core" },
      },
    ]);
  });
});

test("an internal-component target catches an inward-pointing dependency", () => {
  const rule: Rule = {
    id: "inward",
    intent: "no app dependencies",
    forbid: { from: ["domain"], to: { component: "desktop" } },
  };
  expect(
    violations(arch(c("domain", [int("desktop")]), c("desktop")), [rule]),
  ).toMatchObject([
    { status: "violated", edge: { from: "domain", to: "desktop" } },
  ]);
});

test("a clean architecture reports one preserved finding per rule", () => {
  const a = arch(c("core"), c("planner", [ext("@mastra/core")]));
  const rules: Rule[] = [
    {
      id: "pure",
      intent: "x",
      forbid: { from: ["core"], to: { external: "@mastra/*" } },
    },
    {
      id: "confine",
      intent: "y",
      confine: { to: { external: "@mastra/*" }, allowedFrom: ["planner"] },
    },
  ];
  expect(summarize(check(a, rules))).toEqual({
    violated: 0,
    "at-risk": 0,
    preserved: 2,
  });
});

test("formatReport leads with the count header and groups violations first", () => {
  const a = arch(c("desktop", [ext("@mastra/core")]));
  const rule: Rule = {
    id: "mastra-only-in-sidecar",
    intent: "Mastra stays in the sidecar",
    confine: { to: { external: "@mastra/*" }, allowedFrom: ["planner"] },
  };
  const report = formatReport(check(a, [rule]));

  expect(report).toStartWith(
    "Architecture check: 1 violated, 0 at-risk, 0 preserved",
  );
  expect(report).toContain("### Violated");
  expect(report).toContain(
    "- mastra-only-in-sidecar — desktop depends on @mastra/core",
  );
});
