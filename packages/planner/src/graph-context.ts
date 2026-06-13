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

/** A named diagram of the codebase as it stands today, in Mermaid source. */
export interface CodebaseDiagram {
  noun: string;
  mermaid: string;
}

/**
 * Ground the orchestrator in the codebase it is scoping changes against. Unlike
 * {@link withGraphContext}, this is read-only background, not an artifact to
 * edit, so it rides along with the developer's *first* message rather than their
 * latest — the orchestrator should know the existing system from the opening
 * turn. Diagrams with no source are skipped; with none at all the conversation
 * passes through untouched, so a codebase with no artifacts yet still works.
 */
export function withCodebaseContext(
  diagrams: CodebaseDiagram[],
  turns: ChatTurn[],
): ChatTurn[] {
  const present = diagrams.filter((diagram) => diagram.mermaid.trim() !== "");
  if (present.length === 0) return turns;

  const sections = present
    .map((diagram) => `${diagram.noun}, in Mermaid:\n\n${diagram.mermaid.trim()}`)
    .join("\n\n");
  const preface =
    "For context, here is the codebase you are scoping changes against, as it " +
    "stands today. Ground your scoping in it: reason about how the requested " +
    "change touches these real components and entities, and refer to them by " +
    `their actual names rather than inventing a system from scratch.\n\n${sections}`;

  const firstUser = turns.findIndex((turn) => turn.role === "user");
  if (firstUser === -1) {
    return [{ role: "user", content: preface }, ...turns];
  }
  return turns.map((turn, index) =>
    index === firstUser
      ? { ...turn, content: `${preface}\n\n---\n\n${turn.content}` }
      : turn,
  );
}
