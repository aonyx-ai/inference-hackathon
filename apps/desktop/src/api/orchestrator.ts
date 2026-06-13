import type { ChatMessage } from "@inference-hackathon/core";

/** A turn in the provider-agnostic shape the planner server expects. */
interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/**
 * Collapse the session's author-tagged conversation down to the user/assistant
 * turns the model sees. Everything that isn't the developer — the orchestrator
 * and the artifact agents — reads as "assistant" so the model has the full
 * back-and-forth as context.
 */
function toTurns(conversation: ChatMessage[]): ChatTurn[] {
  return conversation.map((message) => ({
    role: message.author === "user" ? "user" : "assistant",
    content: message.text,
  }));
}

/**
 * Where the planner server lives. Empty by default, so requests stay relative
 * and ride Vite's same-origin `/api` proxy in dev. A packaged build (or the
 * sidecar) sets `VITE_API_BASE` to the server's absolute URL, since the webview
 * then talks to it cross-origin rather than through a proxy.
 */
const API_BASE = import.meta.env.VITE_API_BASE ?? "";

/**
 * Ask the orchestrator agent for its next reply. Posts the conversation so far
 * to the planner server and returns the reply text. Throws with the server's
 * message when generation fails — usually a missing or rejected API key.
 */
export async function askOrchestrator(
  conversation: ChatMessage[],
): Promise<string> {
  const response = await fetch(`${API_BASE}/api/orchestrator/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: toTurns(conversation) }),
  });

  const data = (await response.json()) as { text?: string; error?: string };
  if (!response.ok) {
    throw new Error(
      data.error ?? `Orchestrator request failed (${response.status})`,
    );
  }
  return data.text ?? "";
}
