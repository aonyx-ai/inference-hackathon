import { expect, mock, test } from "bun:test";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { GraphBody } from "@inference-hackathon/core";

import { mockSession } from "../data/mockSession";

// The seeded domain artifact is the fixture: a baseline graph the editor acts
// on. (The running app no longer boots into it — the orchestrator spins up the
// real one — but it stays as a hermetic fixture for this screen.)
const domainArtifact = mockSession.artifacts[0]!;
const baselineGraph = domainArtifact.body as GraphBody;

// Stub the domain agent so the screen can be driven without the planner server.
// It returns the full model with a Comment entity added on the task.
const updatedGraph: GraphBody = {
  type: "graph",
  nodes: [
    ...baselineGraph.nodes,
    { id: "comment", label: "Comment", change: "added" },
  ],
  edges: [
    ...baselineGraph.edges,
    { from: "comment", to: "task", label: "on", change: "added" },
  ],
};
const askDomainAgent = mock(async () => ({
  text: "Added a Comment entity linked to Task.",
  body: updatedGraph,
}));
mock.module("../api/artifactAgent", () => ({ askDomainAgent }));

const { renderWithProviders } = await import("../../test/render.tsx");
const { default: App } = await import("../App.tsx");

/** The distinct horizontal positions of the rendered graph nodes. */
function nodeColumns(container: HTMLElement): Set<string> {
  return new Set(
    [...container.querySelectorAll<HTMLElement>(".graph__node")].map(
      (node) => node.style.left,
    ),
  );
}

test("the domain agent edits the artifact's graph and replies in the thread", async () => {
  const { container } = renderWithProviders(<App />, {
    route: `/artifact/${domainArtifact.id}`,
    initialSession: mockSession,
  });
  const user = userEvent.setup();

  // The baseline graph is on the canvas, spread across columns (not stacked in
  // a single vertical line); the new entity isn't there yet.
  expect(screen.getByText("Task")).toBeInTheDocument();
  expect(screen.queryByText("Comment")).not.toBeInTheDocument();
  const columnsBefore = nodeColumns(container);
  expect(columnsBefore.size).toBeGreaterThan(1);

  await user.type(
    screen.getByLabelText("Ask this agent…"),
    "Add a Comment entity on tasks",
  );
  await user.click(screen.getByRole("button", { name: "Send" }));

  // The agent's reply lands in the thread and its edit re-renders the graph,
  // with the differ marking the added node.
  await waitFor(() =>
    expect(
      screen.getByText("Added a Comment entity linked to Task."),
    ).toBeInTheDocument(),
  );
  expect(screen.getByText("Comment")).toBeInTheDocument();
  expect(askDomainAgent).toHaveBeenCalledTimes(1);

  // The graph re-laid-out around the new node rather than collapsing into one
  // column, and every node still sits at its own spot.
  const nodesAfter = container.querySelectorAll<HTMLElement>(".graph__node");
  expect(nodesAfter).toHaveLength(updatedGraph.nodes.length);
  const placementsAfter = new Set(
    [...nodesAfter].map((node) => `${node.style.left}|${node.style.top}`),
  );
  expect(placementsAfter.size).toBe(updatedGraph.nodes.length);
});
