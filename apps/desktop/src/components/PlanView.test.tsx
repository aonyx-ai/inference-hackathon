import { expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import type { Plan } from "@inference-hackathon/core";

import { PlanView } from "./PlanView.tsx";

const plan: Plan = {
  overview:
    "Add tracked PDF export to the dashboard, backed by a render queue.",
  steps: [
    {
      title: "Add the ExportJob aggregate",
      detail: "From the domain model: a new entity linking User and Dashboard.",
    },
    {
      title: "Stand up the rendering pipeline",
      detail:
        "From the architecture graph: ExportController, queue, and renderer.",
    },
  ],
};

test("renders the overview and numbers the steps in order", () => {
  render(<PlanView plan={plan} />);

  expect(
    screen.getByText(/Add tracked PDF export to the dashboard/),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "Add the ExportJob aggregate" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "Stand up the rendering pipeline" }),
  ).toBeInTheDocument();

  // The steps are numbered the way you'd build them.
  expect(screen.getByText("1")).toBeInTheDocument();
  expect(screen.getByText("2")).toBeInTheDocument();
});
