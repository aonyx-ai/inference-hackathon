import { expect, mock, test } from "bun:test";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { GraphBody } from "@inference-hackathon/core";

import { sampleSession } from "../../test/fixtures.ts";

// The architecture artifact from the fixture is the baseline the agent edits.
const architectureArtifact = sampleSession.artifacts.find(
  (artifact) => artifact.kind === "architecture",
)!;
const baselineGraph = architectureArtifact.body as GraphBody;

// Stub the architecture agent so the screen can be driven without the planner
// server. It returns the full map with a CDN component added in front of the UI.
const updatedGraph: GraphBody = {
  type: "graph",
  nodes: [
    ...baselineGraph.nodes,
    { id: "cdn", label: "CDN", group: "infra", change: "added" },
  ],
  edges: [
    ...baselineGraph.edges,
    { from: "cdn", to: "ui", label: "serves", change: "added" },
  ],
};
const askArchitectureAgent = mock(async () => ({
  text: "Put a CDN in front of the dashboard UI.",
  body: updatedGraph,
}));
const askDomainAgent = mock(async () => ({ text: "", body: baselineGraph }));
mock.module("../api/artifactAgent", () => ({
  askArchitectureAgent,
  askDomainAgent,
}));

const { renderWithProviders } = await import("../../test/render.tsx");
const { default: App } = await import("../App.tsx");

test("the architecture agent edits the artifact's map and replies in the thread", async () => {
  renderWithProviders(<App />, {
    route: `/artifact/${architectureArtifact.id}`,
    initialSession: sampleSession,
  });
  const user = userEvent.setup();

  // The baseline map is on the canvas; the new component isn't there yet.
  expect(screen.getByText("ExportController")).toBeInTheDocument();
  expect(screen.queryByText("CDN")).not.toBeInTheDocument();

  await user.type(
    screen.getByLabelText("Ask this agent…"),
    "Serve the dashboard through a CDN",
  );
  await user.click(screen.getByRole("button", { name: "Send" }));

  // The agent's reply lands in the thread and its edit re-renders the map with
  // the new component — proving the artifact screen routed to the architecture
  // agent, not the domain one.
  await waitFor(() =>
    expect(
      screen.getByText("Put a CDN in front of the dashboard UI."),
    ).toBeInTheDocument(),
  );
  expect(screen.getByText("CDN")).toBeInTheDocument();
  expect(askArchitectureAgent).toHaveBeenCalledTimes(1);
  expect(askDomainAgent).not.toHaveBeenCalled();
});
