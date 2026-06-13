import { describe, expect, test } from "bun:test";

import {
  activityFeed,
  artifactKindLabel,
  findArtifact,
  openDecisions,
  type Session,
} from "./index.ts";

function makeSession(): Session {
  return {
    id: "s",
    goal: "g",
    conversation: [],
    artifacts: [
      {
        id: "a1",
        kind: "ux",
        title: "Some artifact",
        summary: "",
        status: "ready",
        conversation: [],
        body: { type: "graph", nodes: [], edges: [] },
      },
    ],
    decisions: [
      {
        id: "d1",
        artifactId: "a1",
        from: "ux",
        question: "open",
        resolved: false,
      },
      {
        id: "d2",
        artifactId: "a1",
        from: "ux",
        question: "done",
        resolved: true,
      },
    ],
  };
}

describe("artifactKindLabel", () => {
  test("maps each kind to a human label", () => {
    expect(artifactKindLabel("architecture")).toBe("Architecture");
    expect(artifactKindLabel("domain")).toBe("Domain Model");
    expect(artifactKindLabel("ux")).toBe("User Experience");
  });
});

describe("openDecisions", () => {
  test("returns only unresolved decisions", () => {
    const open = openDecisions(makeSession());
    expect(open).toHaveLength(1);
    expect(open[0]?.id).toBe("d1");
  });
});

describe("findArtifact", () => {
  test("finds an artifact by id", () => {
    expect(findArtifact(makeSession(), "a1")?.title).toBe("Some artifact");
  });

  test("returns undefined for an unknown id", () => {
    expect(findArtifact(makeSession(), "nope")).toBeUndefined();
  });
});

describe("activityFeed", () => {
  test("interleaves messages and activity in timestamp order", () => {
    const session: Session = {
      ...makeSession(),
      conversation: [
        { id: "m1", author: "user", text: "go", at: "2026-06-13T10:00:00Z" },
        {
          id: "m2",
          author: "orchestrator",
          text: "on it",
          at: "2026-06-13T10:00:03Z",
        },
      ],
      activity: [
        {
          id: "a1",
          kind: "research",
          text: "Read the repository",
          at: "2026-06-13T10:00:02Z",
        },
      ],
    };

    const feed = activityFeed(session);
    expect(feed.map((item) => item.at)).toEqual([
      "2026-06-13T10:00:00Z",
      "2026-06-13T10:00:02Z",
      "2026-06-13T10:00:03Z",
    ]);
    expect(feed.map((item) => item.type)).toEqual([
      "message",
      "activity",
      "message",
    ]);
  });

  test("treats a missing activity log as empty", () => {
    const session: Session = {
      ...makeSession(),
      conversation: [
        { id: "m1", author: "user", text: "hi", at: "2026-06-13T10:00:00Z" },
      ],
    };
    delete session.activity;
    expect(activityFeed(session)).toHaveLength(1);
  });
});
