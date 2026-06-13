/**
 * Domain model for the scoping interface.
 *
 * An orchestrator turns a developer's prompt into a {@link Session}. It spawns
 * one artifact agent per surface (architecture, domain model, and user
 * experience), each of which produces an {@link Artifact}. When an agent needs
 * input it raises a {@link Decision} up to the orchestrator, which surfaces it
 * to the developer.
 */

export type ArtifactKind = "architecture" | "domain" | "ux";

/**
 * Lifecycle of an artifact. `stale` means another artifact changed in a way
 * that may invalidate this one; `needs-input` means its agent raised a
 * {@link Decision}.
 */
export type ArtifactStatus = "drafting" | "needs-input" | "stale" | "ready";

/** Who authored a message — the developer, the orchestrator, or an agent. */
export type Author = "user" | "orchestrator" | ArtifactKind;

export interface ChatMessage {
  id: string;
  author: Author;
  text: string;
  /** ISO 8601 timestamp. */
  at: string;
}

/** How a node or edge changed relative to the current codebase. */
export type Change = "added" | "removed" | "modified" | "unchanged";

export interface GraphNode {
  id: string;
  label: string;
  /** Optional grouping, e.g. a layer or bounded context. */
  group?: string;
  change?: Change;
}

export interface GraphEdge {
  from: string;
  to: string;
  label?: string;
  change?: Change;
}

/** A diffable graph — used for architecture and domain-model artifacts. */
export interface GraphBody {
  type: "graph";
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export type WireframeNodeKind =
  | "container"
  | "text"
  | "input"
  | "button"
  | "list";

/** A box on a 12-column wireframe grid; rows are in arbitrary grid units. */
export interface WireframeNode {
  id: string;
  label: string;
  kind: WireframeNodeKind;
  col: number;
  row: number;
  width: number;
  height: number;
  change?: Change;
}

/** A low-fidelity wireframe — used for user-experience artifacts. */
export interface WireframeBody {
  type: "wireframe";
  screen: string;
  nodes: WireframeNode[];
}

export type ArtifactBodyData = GraphBody | WireframeBody;

export interface Artifact {
  id: string;
  kind: ArtifactKind;
  title: string;
  summary: string;
  status: ArtifactStatus;
  /** The developer's conversation with this artifact's agent. */
  conversation: ChatMessage[];
  body: ArtifactBodyData;
  /** Present when {@link ArtifactStatus} is `stale`; explains the drift. */
  staleReason?: string;
}

/** A question an agent raised up to the orchestrator for the developer. */
export interface Decision {
  id: string;
  artifactId: string;
  from: ArtifactKind;
  question: string;
  resolved: boolean;
}

export interface Session {
  id: string;
  goal: string;
  /** The developer's conversation with the orchestrator. */
  conversation: ChatMessage[];
  artifacts: Artifact[];
  decisions: Decision[];
}

const ARTIFACT_KIND_LABELS: Record<ArtifactKind, string> = {
  architecture: "Architecture",
  domain: "Domain Model",
  ux: "User Experience",
};

export function artifactKindLabel(kind: ArtifactKind): string {
  return ARTIFACT_KIND_LABELS[kind];
}

/** Decisions an agent is still waiting on the developer to answer. */
export function openDecisions(session: Session): Decision[] {
  return session.decisions.filter((decision) => !decision.resolved);
}

export function findArtifact(
  session: Session,
  artifactId: string,
): Artifact | undefined {
  return session.artifacts.find((artifact) => artifact.id === artifactId);
}
