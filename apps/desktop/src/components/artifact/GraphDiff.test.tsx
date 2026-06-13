import { expect, test } from "bun:test";
import { render } from "@testing-library/react";
import type { GraphBody } from "@inference-hackathon/core";

import { GraphDiff, layoutGraph } from "./GraphDiff.tsx";

/** The seeded domain model: three entities, no layer groups. */
const domainGraph: GraphBody = {
  type: "graph",
  nodes: [
    { id: "user", label: "User", change: "unchanged" },
    { id: "project", label: "Project", change: "unchanged" },
    { id: "task", label: "Task", change: "unchanged" },
  ],
  edges: [
    { from: "user", to: "project", change: "unchanged" },
    { from: "project", to: "task", change: "unchanged" },
    { from: "user", to: "task", change: "unchanged" },
  ],
};

/** The same model after the agent adds a Comment entity on Task. */
const editedGraph: GraphBody = {
  type: "graph",
  nodes: [
    ...domainGraph.nodes,
    { id: "comment", label: "Comment", change: "added" },
  ],
  edges: [
    ...domainGraph.edges,
    { from: "comment", to: "task", change: "added" },
  ],
};

/** Read each rendered node's `left/top` so we can reason about the layout. */
function renderedPositions(container: HTMLElement): Map<string, string> {
  const byLabel = new Map<string, string>();
  for (const node of container.querySelectorAll<HTMLElement>(".graph__node")) {
    byLabel.set(node.textContent ?? "", `${node.style.left}|${node.style.top}`);
  }
  return byLabel;
}

test("a groupless domain graph spreads out instead of stacking in one column", () => {
  const positions = [...layoutGraph(domainGraph).values()];

  // The bug this guards: with no groups every node landed at x=50, a single
  // vertical line whose edges drew on top of each other. The nodes must spread.
  const xs = new Set(positions.map((p) => p.x.toFixed(2)));
  expect(xs.size).toBeGreaterThan(1);

  // And no two nodes may share a position, or their edges would overlap.
  const coords = new Set(
    positions.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`),
  );
  expect(coords.size).toBe(domainGraph.nodes.length);
});

test("a grouped graph still lays out in a column per group", () => {
  const grouped: GraphBody = {
    type: "graph",
    nodes: [
      { id: "ui", label: "UI", group: "client" },
      { id: "api", label: "API", group: "api" },
      { id: "db", label: "DB", group: "api" },
    ],
    edges: [],
  };
  const positions = layoutGraph(grouped);

  // Same group → same column (x); different group → different column.
  expect(positions.get("api")!.x).toBe(positions.get("db")!.x);
  expect(positions.get("ui")!.x).not.toBe(positions.get("api")!.x);
});

test("modifying the graph re-renders and re-lays-out the nodes", () => {
  const { container, rerender } = render(<GraphDiff body={domainGraph} />);

  const before = renderedPositions(container);
  expect([...before.keys()].sort()).toEqual(["Project", "Task", "User"]);
  expect(container.querySelectorAll(".graph__edge")).toHaveLength(3);

  rerender(<GraphDiff body={editedGraph} />);

  const after = renderedPositions(container);
  // The new entity rendered, and the differ marked it added.
  expect(after.has("Comment")).toBe(true);
  expect(container.querySelector(".graph__node--added")?.textContent).toBe(
    "Comment",
  );
  expect(container.querySelectorAll(".graph__edge")).toHaveLength(4);

  // Re-jigged, not just appended: the existing nodes moved to make room, and no
  // two nodes overlap after the change.
  expect(after.get("Task")).not.toBe(before.get("Task"));
  expect(new Set(after.values()).size).toBe(editedGraph.nodes.length);
});
