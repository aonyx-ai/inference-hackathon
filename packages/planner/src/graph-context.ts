/**
 * Folding a graph artifact's current state into the chat so its agent edits the
 * real artifact rather than inventing one. Shared by every graph-backed agent —
 * the domain model and the architecture map — which differ only in what to call
 * the thing they own.
 */

/** A turn in the provider-agnostic shape the frontend posts. */
export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

interface GraphLike {
  nodes: unknown[];
  edges: unknown[];
}

/**
 * Fold the current graph into the conversation so the agent edits the real
 * artifact rather than inventing one. The graph rides along with the developer's
 * latest message — prepended to it, or as a fresh turn when there isn't one —
 * which keeps the user/assistant roles alternating for every provider. `noun`
 * names the artifact in the preface, e.g. "domain model" or "architecture map".
 */
export function withGraphContext(
  graph: GraphLike,
  turns: ChatTurn[],
  noun = "domain model",
): ChatTurn[] {
  const serialized = JSON.stringify(
    { nodes: graph.nodes, edges: graph.edges },
    null,
    2,
  );
  const preface =
    `Here is the ${noun} as it stands now, as JSON:\n\n${serialized}\n\n` +
    `Apply the request below and return the complete updated ${noun}.`;

  const lastUser = turns.reduce(
    (found, turn, index) => (turn.role === "user" ? index : found),
    -1,
  );
  if (lastUser === -1) {
    return [{ role: "user", content: preface }, ...turns];
  }
  return turns.map((turn, index) =>
    index === lastUser
      ? { ...turn, content: `${preface}\n\n---\n\n${turn.content}` }
      : turn,
  );
}
