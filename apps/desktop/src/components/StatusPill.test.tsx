import { expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";

import { StatusPill } from "./StatusPill.tsx";

test("renders a human label for each status", () => {
  const { rerender } = render(<StatusPill status="ready" />);
  expect(screen.getByText("Ready")).toBeInTheDocument();

  rerender(<StatusPill status="needs-input" />);
  expect(screen.getByText("Needs input")).toBeInTheDocument();

  rerender(<StatusPill status="stale" />);
  expect(screen.getByText("May be stale")).toBeInTheDocument();

  rerender(<StatusPill status="drafting" />);
  expect(screen.getByText("Drafting")).toBeInTheDocument();
});
