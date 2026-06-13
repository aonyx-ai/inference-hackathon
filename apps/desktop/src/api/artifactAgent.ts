import type { ChatMessage, GraphBody } from "@inference-hackathon/core";
import { API_BASE, toTurns } from "./planner";

/** What the domain agent sends back: a chat reply and the updated graph. */
export interface DomainAgentReply {
  text: string;
  body: GraphBody;
}

/**
 * Ask the domain-model agent to edit the model. Posts the current graph along
 * with the conversation so far and returns the agent's reply plus the complete
 * updated graph, ready to drop straight into the artifact's body so the differ
 * re-renders. Throws with the server's message when generation fails — usually
 * a missing or rejected API key.
 */
export async function askDomainAgent(
  body: GraphBody,
  conversation: ChatMessage[],
): Promise<DomainAgentReply> {
  const response = await fetch(`${API_BASE}/api/domain/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: toTurns(conversation), body }),
  });

  const data = (await response.json()) as {
    text?: string;
    body?: GraphBody;
    error?: string;
  };
  if (!response.ok || !data.body) {
    throw new Error(
      data.error ?? `Domain agent request failed (${response.status})`,
    );
  }
  return { text: data.text ?? "", body: data.body };
}
