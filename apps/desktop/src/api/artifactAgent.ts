import type { ChatMessage, GraphBody } from "@inference-hackathon/core";
import { API_BASE, toTurns } from "./planner";

/** What a graph artifact agent sends back: a chat reply and the updated graph. */
export interface ArtifactAgentReply {
  text: string;
  body: GraphBody;
  /** A question the agent bubbled up for the developer to settle, if any. */
  raise?: string;
}

/** Back-compat alias for the domain agent's reply shape. */
export type DomainAgentReply = ArtifactAgentReply;

/**
 * Ask a graph artifact agent to edit its graph. Posts the current graph along
 * with the conversation so far and returns the agent's reply plus the complete
 * updated graph, ready to drop straight into the artifact's body so the differ
 * re-renders. Throws with the server's message when generation fails — usually a
 * missing or rejected API key.
 */
async function askGraphAgent(
  path: string,
  label: string,
  body: GraphBody,
  conversation: ChatMessage[],
): Promise<ArtifactAgentReply> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: toTurns(conversation), body }),
  });

  const data = (await response.json()) as {
    text?: string;
    body?: GraphBody;
    raise?: string;
    error?: string;
  };
  if (!response.ok || !data.body) {
    throw new Error(
      data.error ?? `${label} agent request failed (${response.status})`,
    );
  }
  return { text: data.text ?? "", body: data.body, raise: data.raise };
}

/** Ask the domain-model agent to edit the model. */
export function askDomainAgent(
  body: GraphBody,
  conversation: ChatMessage[],
): Promise<ArtifactAgentReply> {
  return askGraphAgent("/api/domain/chat", "Domain", body, conversation);
}

/** Ask the architecture agent to edit the component map. */
export function askArchitectureAgent(
  body: GraphBody,
  conversation: ChatMessage[],
): Promise<ArtifactAgentReply> {
  return askGraphAgent(
    "/api/architecture/chat",
    "Architecture",
    body,
    conversation,
  );
}
