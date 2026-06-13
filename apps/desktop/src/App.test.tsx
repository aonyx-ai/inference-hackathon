import { afterEach, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";

import App from "./App.tsx";

afterEach(() => {
  clearMocks();
});

test("greets the entered name via the mocked greet command", async () => {
  mockIPC((cmd, args) => {
    if (cmd === "greet") {
      const { name } = args as { name: string };
      return `Hello, ${name}! You've been greeted from Rust!`;
    }
  });

  render(<App />);

  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Name"), "Alice");
  await user.click(screen.getByRole("button", { name: "Greet" }));

  expect(
    await screen.findByText("Hello, Alice! You've been greeted from Rust!"),
  ).toBeInTheDocument();
});
