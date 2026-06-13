import { expect, mock, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Composer } from "./Composer.tsx";

test("sends trimmed text and clears the input", async () => {
  const onSend = mock((_text: string) => {});
  render(<Composer placeholder="Reply" onSend={onSend} />);

  const user = userEvent.setup();
  const input = screen.getByLabelText("Reply") as HTMLInputElement;
  await user.type(input, "  hello  ");
  await user.click(screen.getByRole("button", { name: "Send" }));

  expect(onSend).toHaveBeenCalledWith("hello");
  expect(input.value).toBe("");
});

test("does not send when the input is empty or whitespace", async () => {
  const onSend = mock((_text: string) => {});
  render(<Composer placeholder="Reply" onSend={onSend} />);

  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Reply"), "   ");
  await user.click(screen.getByRole("button", { name: "Send" }));

  expect(onSend).not.toHaveBeenCalled();
});
