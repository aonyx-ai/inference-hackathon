import type { ChatMessage, GraphBody } from "@inference-hackathon/core";
import type { DomainModel } from "@inference-hackathon/domain";
import { API_BASE, toTurns } from "./planner";

/** What the architecture agent sends back: a chat reply and the updated graph. */
export interface ArtifactAgentReply {
  text: string;
  body: GraphBody;
  /** A question the agent bubbled up for the developer to settle, if any. */
  raise?: string;
}

/** What the domain agent sends back: a chat reply and the updated model. */
export interface DomainAgentReply {
  text: string;
  model: DomainModel;
  /** A question the agent bubbled up for the developer to settle, if any. */
  raise?: string;
}

/**
 * Ask the architecture agent to edit its graph. Posts the current graph along
 * with the conversation so far and returns the agent's reply plus the complete
 * updated graph, ready to drop straight into the artifact's body so the differ
 * re-renders. Throws with the server's message when generation fails — usually a
 * missing or rejected API key.
 */
export async function askArchitectureAgent(
  body: GraphBody,
  conversation: ChatMessage[],
): Promise<ArtifactAgentReply> {
  const response = await fetch(`${API_BASE}/api/architecture/chat`, {
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
      data.error ?? `Architecture agent request failed (${response.status})`,
    );
  }
  return { text: data.text ?? "", body: data.body, raise: data.raise };
}

/**
 * Ask the domain-model agent to edit the model. Posts the current model with the
 * conversation and returns the agent's reply plus the complete updated model,
 * which the deck overlays on the codebase baseline to color the change. Throws
 * with the server's message when generation fails.
 */
export async function askDomainAgent(
  model: DomainModel,
  conversation: ChatMessage[],
): Promise<DomainAgentReply> {
  const response = await fetch(`${API_BASE}/api/domain/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: toTurns(conversation), model }),
  });

  const data = (await response.json()) as {
    text?: string;
    model?: DomainModel;
    raise?: string;
    error?: string;
  };
  if (!response.ok || !data.model) {
    throw new Error(
      data.error ?? `Domain agent request failed (${response.status})`,
    );
  }
  return { text: data.text ?? "", model: data.model, raise: data.raise };
}
