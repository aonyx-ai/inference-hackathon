import { expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import type { ChatMessage } from "@inference-hackathon/core";

import { Message } from "./Message.tsx";

function message(text: string): ChatMessage {
  return { id: "1", author: "architecture", text, at: "" };
}

test("renders Markdown emphasis and lists as elements, not raw text", () => {
  const { container } = render(
    <Message
      message={message(
        "Here's the plan:\n\n- **Add** an endpoint\n- Wire it up",
      )}
    />,
  );

  expect(container.querySelector("strong")?.textContent).toBe("Add");
  expect(container.querySelectorAll(".markdown li")).toHaveLength(2);
  // The asterisks must not survive into the rendered output.
  expect(screen.queryByText(/\*\*Add\*\*/)).toBeNull();
});

test("renders fenced code blocks", () => {
  const { container } = render(
    <Message message={message("Run this:\n\n```\nbun install\n```")} />,
  );

  expect(container.querySelector("pre code")?.textContent).toContain(
    "bun install",
  );
});

test("escapes raw HTML rather than executing it", () => {
  const { container } = render(
    <Message message={message("<script>alert(1)</script> done")} />,
  );

  expect(container.querySelector("script")).toBeNull();
  expect(screen.getByText(/alert\(1\)/)).toBeInTheDocument();
});
