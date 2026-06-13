import { expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ActivityEvent } from "@inference-hackathon/core";

import { ActivityItem } from "./ActivityItem.tsx";

function event(extra: Partial<ActivityEvent>): ActivityEvent {
  return {
    id: "e1",
    kind: "research",
    text: "Read the repo",
    at: "",
    ...extra,
  };
}

test("a lifecycle event reads as calm history, not a call to action", () => {
  const { container } = render(<ActivityItem event={event({})} />);

  expect(screen.getByText("Read the repo")).toBeInTheDocument();
  // No accent button when there's nothing to open and nothing to answer.
  expect(container.querySelector(".activity-item")).toBeNull();
  expect(container.querySelector("button")).toBeNull();
});

test("a pending event marks itself live", () => {
  const { container } = render(
    <ActivityItem event={event({ pending: true })} />,
  );

  expect(container.querySelector(".activity-event--pending")).not.toBeNull();
});

test("an event naming an artifact opens it when clicked", async () => {
  const user = userEvent.setup();
  let opened: string | undefined;
  render(
    <ActivityItem
      event={event({
        kind: "draft",
        from: "architecture",
        artifactId: "a-arch",
      })}
      onOpen={(id) => (opened = id)}
    />,
  );

  await user.click(screen.getByRole("button"));
  expect(opened).toBe("a-arch");
});

test("an open decision wears the accent needs-input affordance", () => {
  const { container } = render(
    <ActivityItem
      event={event({
        kind: "decision-raised",
        from: "domain",
        artifactId: "a-domain",
        text: "Track exports or not?",
      })}
    />,
  );

  expect(container.querySelector(".activity-item")).not.toBeNull();
  expect(
    screen.getByText(/Domain Model agent needs input/),
  ).toBeInTheDocument();
});

test("a resolved decision drops the accent and becomes history", () => {
  const { container } = render(
    <ActivityItem
      event={event({
        kind: "decision-raised",
        from: "domain",
        artifactId: "a-domain",
        text: "Track exports or not?",
      })}
      resolved
    />,
  );

  // Once answered it's no longer a call to action, just a clickable record.
  expect(container.querySelector(".activity-item")).toBeNull();
  expect(container.querySelector(".activity-event")).not.toBeNull();
});
