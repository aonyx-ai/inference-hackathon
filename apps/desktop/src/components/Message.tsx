import type { Author, ChatMessage } from "@inference-hackathon/core";
import { artifactKindLabel } from "@inference-hackathon/core";

export function authorLabel(author: Author): string {
  if (author === "user") return "You";
  if (author === "orchestrator") return "Orchestrator";
  return `${artifactKindLabel(author)} agent`;
}

/** A single chat message, reused in the orchestrator feed and agent threads. */
export function Message({ message }: { message: ChatMessage }) {
  const mine = message.author === "user";
  return (
    <li className={`message ${mine ? "message--mine" : "message--theirs"}`}>
      <span className="message__author">{authorLabel(message.author)}</span>
      <p className="message__text">{message.text}</p>
    </li>
  );
}
