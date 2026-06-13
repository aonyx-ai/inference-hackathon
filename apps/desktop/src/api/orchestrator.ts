import type {
  Artifact,
  ChatMessage,
  GraphEdge,
  GraphNode,
} from "@inference-hackathon/core";
import { API_BASE, toTurns } from "./planner";

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

/** The graph the domain modeler returns, before it is dressed as an artifact. */
interface DomainArtifactResponse {
  title: string;
  summary: string;
  nodes: { id: string; label: string }[];
  edges: { from: string; to: string; label: string }[];
  error?: string;
}

let domainArtifactCounter = 0;

/**
 * Ask the domain modeler to scope the task as a domain-model graph and return it
 * as a ready artifact. Everything the model produces is new, so each node and
 * edge is marked as added for the diff view. Throws with the server's message on
 * failure.
 */
export async function createDomainArtifact(goal: string): Promise<Artifact> {
  const response = await fetch(`${API_BASE}/api/orchestrator/domain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ goal }),
  });

  const data = (await response.json()) as DomainArtifactResponse;
  if (!response.ok) {
    throw new Error(
      data.error ?? `Domain artifact request failed (${response.status})`,
    );
  }

  domainArtifactCounter += 1;
  return {
    id: `domain-${domainArtifactCounter}`,
    kind: "domain",
    title: data.title,
    summary: data.summary,
    status: "ready",
    conversation: [],
    body: {
      type: "graph",
      nodes: data.nodes.map(
        (node): GraphNode => ({
          id: node.id,
          label: node.label,
          change: "added",
        }),
      ),
      edges: data.edges.map(
        (edge): GraphEdge => ({
          from: edge.from,
          to: edge.to,
          label: edge.label,
          change: "added",
        }),
      ),
    },
  };
}
