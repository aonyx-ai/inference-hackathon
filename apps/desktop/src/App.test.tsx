import { expect, test } from "bun:test";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { renderWithProviders } from "../test/render.tsx";
import App from "./App.tsx";

test("orchestration screen shows the task, an agent question, and the artifacts", () => {
  renderWithProviders(<App />);

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
  renderWithProviders(<App />);
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

test("a stale artifact surfaces a drift banner explaining the drift", () => {
  renderWithProviders(<App />, { route: "/artifact/a-ux" });

  expect(screen.getByText("May be stale")).toBeInTheDocument();
  expect(
    screen.getByText(/synchronous vs\. queued rendering/),
  ).toBeInTheDocument();
});
