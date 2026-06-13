/**
 * Folding an artifact's current state into the chat so its agent edits the real
 * artifact rather than inventing one. The domain agent owns a structured domain
 * model; the architecture agent still owns a node/edge graph. Both ride along
 * with the developer's latest message so the user/assistant roles stay
 * alternating for every provider.
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
 * Prepend `preface` to the developer's latest message — or add it as a fresh
 * user turn when there isn't one — which keeps the roles alternating.
 */
function foldPreface(preface: string, turns: ChatTurn[]): ChatTurn[] {
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

/**
 * Fold the current graph into the conversation so the agent edits the real
 * artifact rather than inventing one. `noun` names the artifact in the preface,
 * e.g. "architecture map".
 */
export function withGraphContext(
  graph: GraphLike,
  turns: ChatTurn[],
  noun = "architecture map",
): ChatTurn[] {
  const serialized = JSON.stringify(
    { nodes: graph.nodes, edges: graph.edges },
    null,
    2,
  );
  const preface =
    `Here is the ${noun} as it stands now, as JSON:\n\n${serialized}\n\n` +
    `Apply the request below and return the complete updated ${noun}.`;
  return foldPreface(preface, turns);
}

/**
 * Fold the current domain model into the conversation, mirroring
 * {@link withGraphContext} for the structured model the domain agent owns.
 */
export function withModelContext(
  model: unknown,
  turns: ChatTurn[],
): ChatTurn[] {
  const serialized = JSON.stringify(model, null, 2);
  const preface =
    `Here is the domain model as it stands now, as JSON:\n\n${serialized}\n\n` +
    `Apply the request below and return the complete updated model.`;
  return foldPreface(preface, turns);
}
