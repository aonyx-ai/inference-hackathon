import { expect, test } from "bun:test";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithProviders } from "../test/render.tsx";
import { sampleSession } from "../test/fixtures.ts";
import App from "./App.tsx";

test("starts on an empty orchestration screen inviting a task", () => {
  renderWithProviders(<App />);

  expect(
    screen.getByRole("heading", {
      name: "Describe the change you want to scope",
    }),
  ).toBeInTheDocument();
  expect(
    screen.getByPlaceholderText("Describe the task you want to scope…"),
  ).toBeInTheDocument();
  // Nothing fabricated: no artifacts until the orchestrator produces them.
  expect(screen.queryByText("Artifacts")).not.toBeInTheDocument();
});

test("renders the task, an agent question, and the artifacts from state", () => {
  renderWithProviders(<App />, { initialSession: sampleSession });

  expect(
    screen.getByRole("heading", {
      name: "Let users export their dashboard as a PDF",
    }),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/Architecture agent needs input/),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "PDF rendering pipeline" }),
  ).toBeInTheDocument();
});

test("clicking an agent question opens that artifact's screen and back returns", async () => {
  renderWithProviders(<App />, { initialSession: sampleSession });
  const user = userEvent.setup();

  await user.click(screen.getByText(/Architecture agent needs input/));

  // The artifact agent screen is showing: its agent composer and back control.
  expect(screen.getByPlaceholderText("Ask this agent…")).toBeInTheDocument();
  const back = screen.getByRole("button", { name: "← Orchestration" });
  expect(back).toBeInTheDocument();

  await user.click(back);
  expect(
    screen.getByRole("heading", {
      name: "Let users export their dashboard as a PDF",
    }),
  ).toBeInTheDocument();
});

test("renders the synthesized plan below the deck once one is present", () => {
  renderWithProviders(<App />, {
    initialSession: {
      ...sampleSession,
      plan: {
        overview: "Add tracked PDF export, backed by a render queue.",
        steps: [
          {
            title: "Add the ExportJob aggregate",
            detail: "From the domain model.",
          },
        ],
      },
    },
  });

  // The orchestrator decides when scoping is done, so there is no button — the
  // plan simply reads out below the deck once it has been synthesized.
  expect(screen.getByRole("heading", { name: "Plan" })).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "Add the ExportJob aggregate" }),
  ).toBeInTheDocument();
});

test("shows no plan section until one has been synthesized", () => {
  // Artifacts are present, but the developer hasn't signaled they're done.
  renderWithProviders(<App />, { initialSession: sampleSession });

  expect(
    screen.queryByRole("heading", { name: "Plan" }),
  ).not.toBeInTheDocument();
});

test("a stale artifact surfaces a drift banner explaining the drift", () => {
  renderWithProviders(<App />, {
    route: "/artifact/a-ux",
    initialSession: sampleSession,
  });

  expect(screen.getByText("May be stale")).toBeInTheDocument();
  expect(
    screen.getByText(/synchronous vs\. queued rendering/),
  ).toBeInTheDocument();
});
