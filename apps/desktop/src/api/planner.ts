import type { ChatMessage } from "@inference-hackathon/core";

/** A turn in the provider-agnostic shape the planner server expects. */
export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/**
 * Collapse a session's author-tagged conversation down to the user/assistant
 * turns the model sees. Everything that isn't the developer — the orchestrator
 * and the artifact agents — reads as "assistant" so the model has the full
 * back-and-forth as context.
 */
export function toTurns(conversation: ChatMessage[]): ChatTurn[] {
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
export const API_BASE = import.meta.env.VITE_API_BASE ?? "";
