import { expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import type {
  DesignBody,
  GraphBody,
  WireframeBody,
} from "@inference-hackathon/core";

import { ArtifactBody } from "./ArtifactBody.tsx";

test("renders a graph body with node labels and marks added nodes", () => {
  const body: GraphBody = {
    type: "graph",
    nodes: [
      { id: "a", label: "ExportController", change: "added" },
      { id: "b", label: "DashboardService" },
    ],
    edges: [{ from: "a", to: "b", change: "added" }],
  };

  const { container } = render(<ArtifactBody body={body} />);

  expect(screen.getByText("ExportController")).toBeInTheDocument();
  expect(screen.getByText("DashboardService")).toBeInTheDocument();
  expect(container.querySelector(".graph__node--added")).not.toBeNull();
});

test("renders a wireframe body with labels and marks added nodes", () => {
  const body: WireframeBody = {
    type: "wireframe",
    screen: "Dashboard",
    nodes: [
      {
        id: "h",
        label: "Header",
        kind: "container",
        col: 0,
        row: 0,
        width: 12,
        height: 1,
      },
      {
        id: "e",
        label: "Export",
        kind: "button",
        col: 10,
        row: 0,
        width: 2,
        height: 1,
        change: "added",
      },
    ],
  };

  const { container } = render(<ArtifactBody body={body} />);

  expect(screen.getByText("Header")).toBeInTheDocument();
  expect(screen.getByText("Export")).toBeInTheDocument();
  expect(container.querySelector(".wireframe__node--added")).not.toBeNull();
});

test("renders a design body as a current/proposed side-by-side", () => {
  const body: DesignBody = {
    type: "design",
    before: {
      screen: "Dashboard",
      root: {
        id: "card",
        component: "card",
        children: [{ id: "h", component: "heading", props: { label: "Acme" } }],
      },
    },
    after: {
      screen: "Dashboard",
      root: {
        id: "card",
        component: "card",
        children: [
          { id: "h", component: "heading", props: { label: "Acme" } },
          {
            id: "cta",
            component: "button",
            props: { label: "Share" },
            change: "added",
          },
        ],
      },
    },
    tokens: [{ name: "--accent", before: "#c96442", after: "#3b6ea5" }],
  };

  const { container } = render(<ArtifactBody body={body} />);

  expect(screen.getByText("Proposed")).toBeInTheDocument();
  expect(container.querySelector(".design__pane--after")).not.toBeNull();
});
