import { expect, mock, test } from "bun:test";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { DomainBody } from "@inference-hackathon/core";
import type { DomainModel } from "@inference-hackathon/domain";

import { mockSession } from "../data/mockSession";

// The seeded domain artifact is the fixture: the baseline model the editor acts
// on. (The running app no longer boots into it — the orchestrator spins up the
// real one — but it stays as a hermetic fixture for this screen.)
const domainArtifact = mockSession.artifacts[0]!;
const baseline = (domainArtifact.body as DomainBody).model;

// The agent's edit: the full model with a Comment entity added on Task.
const updatedModel: DomainModel = {
  contexts: baseline.contexts,
  entities: [
    ...baseline.entities.map((entity) =>
      entity.id === "task"
        ? {
            ...entity,
            fields: [
              ...entity.fields,
              {
                id: "task.comments",
                name: "comments",
                type: { kind: "Contains", target: "comment" } as const,
                collection: true,
              },
            ],
          }
        : entity,
    ),
    {
      id: "comment",
      name: "Comment",
      kind: "Entity",
      context: "collaboration",
      fields: [
        {
          id: "comment.id",
          name: "id",
          type: { kind: "Scalar", name: "CommentId" } as const,
          role: "Identity",
        },
      ],
    },
  ],
};

// Stub the domain agent so the screen can be driven without the planner server,
// and Mermaid so the diagram renders deterministically; we capture each source
// it is handed to prove the model edit reaches the canvas.
const askDomainAgent = mock(async () => ({
  text: "Added a Comment entity linked to Task.",
  model: updatedModel,
}));
mock.module("../api/artifactAgent", () => ({ askDomainAgent }));

const renderedSources: string[] = [];
const renderMock = mock(async (_id: string, source: string) => {
  renderedSources.push(source);
  return { svg: "<svg data-testid='diagram'></svg>" };
});
mock.module("mermaid", () => ({
  default: { initialize: mock(() => {}), render: renderMock },
}));

const { renderWithProviders } = await import("../../test/render.tsx");
const { default: App } = await import("../App.tsx");

test("the domain agent edits the model and replies in the thread", async () => {
  renderWithProviders(<App />, {
    route: `/artifact/${domainArtifact.id}`,
    initialSession: mockSession,
  });
  const user = userEvent.setup();

  // The baseline model is projected onto the canvas; the new entity isn't in it.
  await waitFor(() => expect(renderedSources.length).toBeGreaterThan(0));
  expect(renderedSources.at(-1)).toContain("Task");
  expect(renderedSources.at(-1)).not.toContain("Comment");

  await user.type(
    screen.getByLabelText("Ask this agent…"),
    "Add a Comment entity on tasks",
  );
  await user.click(screen.getByRole("button", { name: "Send" }));

  // The agent's reply lands in the thread and its edit re-projects the diagram
  // with the new entity, leaving the baseline untouched.
  await waitFor(() =>
    expect(
      screen.getByText("Added a Comment entity linked to Task."),
    ).toBeInTheDocument(),
  );
  expect(askDomainAgent).toHaveBeenCalledTimes(1);
  expect(askDomainAgent.mock.calls[0]?.[0]).toEqual(baseline);
  await waitFor(() => expect(renderedSources.at(-1)).toContain("Comment"));
});
