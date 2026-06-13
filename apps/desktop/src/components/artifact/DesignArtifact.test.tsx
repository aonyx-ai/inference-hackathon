import { expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import type { DesignBody } from "@inference-hackathon/core";

import { DesignArtifact } from "./DesignArtifact.tsx";

const body: DesignBody = {
  type: "design",
  before: {
    screen: "Demo",
    root: {
      id: "card",
      component: "card",
      children: [{ id: "h", component: "heading", props: { label: "Title" } }],
    },
  },
  after: {
    screen: "Demo",
    root: {
      id: "card",
      component: "card",
      children: [
        { id: "h", component: "heading", props: { label: "Title" } },
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

test("renders both panes with their scenes", () => {
  render(<DesignArtifact body={body} />);

  expect(screen.getByText("Current")).toBeInTheDocument();
  expect(screen.getByText("Proposed")).toBeInTheDocument();
  // The shared heading shows in each pane; the added button only in Proposed.
  expect(screen.getAllByText("Title")).toHaveLength(2);
  expect(screen.getByText("Share")).toBeInTheDocument();
});

test("themes each pane with its side of the token delta", () => {
  const { container } = render(<DesignArtifact body={body} />);

  const current = container.querySelector<HTMLElement>(
    '[aria-label="Current design"]',
  );
  const proposed = container.querySelector<HTMLElement>(".design__pane--after");

  expect(current?.style.getPropertyValue("--accent")).toBe("#c96442");
  expect(proposed?.style.getPropertyValue("--accent")).toBe("#3b6ea5");
});

test("outlines an added node and lists the token delta", () => {
  const { container } = render(<DesignArtifact body={body} />);

  expect(container.querySelector(".design__node--added")).not.toBeNull();
  expect(screen.getByText("--accent")).toBeInTheDocument();
});

test("falls back to a labeled box for an unknown component", () => {
  const fallback = {
    type: "design",
    before: {
      screen: "x",
      root: { id: "r", component: "mystery", props: { label: "Mystery" } },
    },
    after: {
      screen: "x",
      root: { id: "r", component: "mystery", props: { label: "Mystery" } },
    },
  } as unknown as DesignBody;

  const { container } = render(<DesignArtifact body={fallback} />);

  expect(container.querySelector(".ui-fallback")).not.toBeNull();
  expect(screen.getAllByText("Mystery")).toHaveLength(2);
});

test("hides the token legend in preview mode", () => {
  const { container } = render(<DesignArtifact body={body} preview />);

  expect(container.querySelector(".design--preview")).not.toBeNull();
  expect(container.querySelector(".design__legend")).toBeNull();
});
