import { describe, expect, test } from "bun:test";

import { formatSurfaceContext, type RepoContext } from "./research.ts";

const context: RepoContext = {
  goal: "Add CSV export to reports",
  root: "/repo",
  surfaces: {
    architecture: {
      summary: "Reports live in packages/reports and render server-side.",
      relevantPaths: [{ path: "packages/reports/src/render.ts", why: "entry" }],
      touchpoints: ["renderReport"],
      conventions: ["errors bubble as Result types"],
      openQuestions: ["streamed or buffered?"],
    },
    domain: {
      summary: "A Report aggregates Rows.",
      relevantPaths: [],
      touchpoints: [],
      conventions: [],
      openQuestions: [],
    },
    ux: {
      summary: "The report screen has a toolbar.",
      relevantPaths: [],
      touchpoints: [],
      conventions: [],
      openQuestions: [],
    },
  },
};

describe("formatSurfaceContext", () => {
  test("renders a populated surface with all its sections", () => {
    const text = formatSurfaceContext(context, "architecture");
    expect(text).toContain("architecture surface");
    expect(text).toContain("packages/reports/src/render.ts: entry");
    expect(text).toContain("renderReport");
    expect(text).toContain("errors bubble as Result types");
    expect(text).toContain("streamed or buffered?");
  });

  test("omits empty sections", () => {
    const text = formatSurfaceContext(context, "domain");
    expect(text).toContain("A Report aggregates Rows.");
    expect(text).not.toContain("Relevant paths:");
    expect(text).not.toContain("Open questions:");
  });
});
