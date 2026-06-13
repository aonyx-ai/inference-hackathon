/**
 * Architectural rules and the check that evaluates them against the dependency
 * graph.
 *
 * Rules are declarative constraints over the edges. `forbid` says a set of
 * components may not depend on a target; `confine` says only a set of components
 * may. Each rule carries its `intent` — the goal it protects — so a review
 * explains *why* a change is wrong, not merely that it is. That intent is where
 * the rationale lives, replacing a separate decision document.
 *
 * `check` returns findings classified preserved | violated | at-risk, mirroring
 * the domain diff's compatibility so both review surfaces read the same way.
 * The deterministic checks here produce preserved and violated; `at-risk` is
 * reserved for a softer, cheap-model judgment layer (e.g. a forming cycle).
 */

import type { Architecture, Dependency } from "./model.ts";

/** What a rule points at: an internal component by id, or external deps by glob. */
export type Target =
  | { readonly component: string }
  | { readonly external: string };

interface RuleBase {
  readonly id: string;
  readonly intent: string;
}

export type Rule =
  | (RuleBase & {
      readonly forbid: {
        readonly from: readonly string[];
        readonly to: Target;
      };
    })
  | (RuleBase & {
      readonly confine: {
        readonly to: Target;
        readonly allowedFrom: readonly string[];
      };
    });

export type Status = "preserved" | "violated" | "at-risk";

export interface Finding {
  readonly rule: string;
  readonly intent: string;
  readonly status: Status;
  readonly detail: string;
  /** The offending dependency, by display name, for highlighting on the graph. */
  readonly edge?: { readonly from: string; readonly to: string };
}

/** Match an npm package name against a glob such as `@mastra/*` or `react`. */
function matchesPattern(name: string, pattern: string): boolean {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`).test(name);
}

function targetMatches(dep: Dependency, target: Target): boolean {
  if ("component" in target)
    return dep.kind === "internal" && dep.to === target.component;
  return dep.kind === "external" && matchesPattern(dep.to, target.external);
}

/** Evaluate every rule against the architecture, one finding per outcome. */
export function check(
  architecture: Architecture,
  rules: readonly Rule[],
): readonly Finding[] {
  const findings: Finding[] = [];
  const nameById = new Map(architecture.components.map((c) => [c.id, c.name]));
  const label = (id: string, external: boolean) =>
    external ? id : (nameById.get(id) ?? id);

  for (const rule of rules) {
    const offending: Array<{ from: string; to: string }> = [];
    for (const component of architecture.components) {
      for (const dep of component.dependsOn) {
        const violates =
          "forbid" in rule
            ? rule.forbid.from.includes(component.id) &&
              targetMatches(dep, rule.forbid.to)
            : targetMatches(dep, rule.confine.to) &&
              !rule.confine.allowedFrom.includes(component.id);
        if (violates) {
          offending.push({
            from: label(component.id, false),
            to: label(dep.to, dep.kind === "external"),
          });
        }
      }
    }

    if (offending.length === 0) {
      findings.push({
        rule: rule.id,
        intent: rule.intent,
        status: "preserved",
        detail: "",
      });
    } else {
      for (const edge of offending) {
        findings.push({
          rule: rule.id,
          intent: rule.intent,
          status: "violated",
          detail: `${edge.from} depends on ${edge.to}`,
          edge,
        });
      }
    }
  }

  return findings;
}

/** Count findings by status. */
export function summarize(
  findings: readonly Finding[],
): Record<Status, number> {
  const counts: Record<Status, number> = {
    preserved: 0,
    violated: 0,
    "at-risk": 0,
  };
  for (const finding of findings) counts[finding.status] += 1;
  return counts;
}

/** Render findings as Markdown, grouped by status with violations first. */
export function formatReport(findings: readonly Finding[]): string {
  const counts = summarize(findings);
  const header = `Architecture check: ${counts.violated} violated, ${counts["at-risk"]} at-risk, ${counts.preserved} preserved`;
  const groups: Array<{ status: Status; title: string }> = [
    { status: "violated", title: "Violated" },
    { status: "at-risk", title: "At-risk" },
    { status: "preserved", title: "Preserved" },
  ];
  const lines = [header];

  for (const { status, title } of groups) {
    const group = findings.filter((finding) => finding.status === status);
    if (group.length === 0) continue;
    lines.push("", `### ${title}`, "");
    for (const finding of group) {
      if (status === "preserved") {
        lines.push(`- ${finding.rule}`);
      } else {
        lines.push(
          `- ${finding.rule} — ${finding.detail}`,
          `  ${finding.intent}`,
        );
      }
    }
  }

  return lines.join("\n");
}
