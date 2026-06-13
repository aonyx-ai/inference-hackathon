import { expect, mock, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ChatMessage } from "@inference-hackathon/core";

import { ConversationThread } from "./ConversationThread.tsx";

const messages: ChatMessage[] = [
  { id: "1", author: "user", text: "Add export", at: "" },
  { id: "2", author: "architecture", text: "On it", at: "" },
];

test("renders each message with its author label", () => {
  render(
    <ConversationThread
      title="Planning"
      messages={messages}
      placeholder="Reply"
      onSend={() => {}}
    />,
  );

  expect(screen.getByText("Add export")).toBeInTheDocument();
  expect(screen.getByText("On it")).toBeInTheDocument();
  expect(screen.getByText("You")).toBeInTheDocument();
  expect(screen.getByText("Architecture agent")).toBeInTheDocument();
});

test("forwards composed text to onSend", async () => {
  const onSend = mock((_text: string) => {});
  render(
    <ConversationThread
      title="Planning"
      messages={messages}
      placeholder="Reply"
      onSend={onSend}
    />,
  );

  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Reply"), "use a queue");
  await user.click(screen.getByRole("button", { name: "Send" }));

  expect(onSend).toHaveBeenCalledWith("use a queue");
});
