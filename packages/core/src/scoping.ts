/**
 * Domain model for the scoping interface.
 *
 * An orchestrator turns a developer's prompt into a {@link Session}. It spawns
 * one artifact agent per surface (architecture, domain model, and user
 * experience), each of which produces an {@link Artifact}. When an agent needs
 * input it raises a {@link Decision} up to the orchestrator, which surfaces it
 * to the developer.
 */

import type { DomainModel } from "@inference-hackathon/domain";

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

/** A diffable graph — used for architecture artifacts. */
export interface GraphBody {
  type: "graph";
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * A domain-model artifact: the structured {@link DomainModel} itself, rendered
 * directly as a Mermaid class diagram. `baseline` is the model as it stands in
 * the codebase and never changes; `model` is the current, possibly agent-edited
 * model. The renderer overlays the two so edits color against the codebase.
 */
export interface DomainBody {
  type: "domain";
  baseline: DomainModel;
  model: DomainModel;
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

/**
 * The bounded vocabulary a high-fidelity design scene is built from. Keeping it
 * a closed set lets a renderer map each name to a real, themed component;
 * anything outside it falls back to a labeled box, so an agent can always
 * describe something.
 */
export type UiComponent =
  | "stack"
  | "row"
  | "card"
  | "header"
  | "heading"
  | "text"
  | "button"
  | "field"
  | "badge"
  | "list"
  | "listItem";

/** A node in a design scene's component tree. */
export interface UiNode {
  id: string;
  component: UiComponent;
  /** Props the renderer understands, e.g. `label`, `variant`, `placeholder`. */
  props?: Record<string, string>;
  children?: UiNode[];
  change?: Change;
}

/** A named screen described as a tree of {@link UiNode}s. */
export interface DesignScene {
  screen: string;
  root: UiNode;
}

/**
 * A single design-token change applied to the proposed pane, e.g. swapping the
 * primary accent. `name` is a CSS custom property such as `--accent`.
 */
export interface TokenDelta {
  name: string;
  before: string;
  after: string;
}

/**
 * A high-fidelity UI design diff — used for user-experience artifacts. The
 * current and proposed scenes render side by side from a structured component
 * tree, with optional token deltas themed onto the proposed pane. A pure accent
 * change is the degenerate case: the same tree before and after, one entry in
 * {@link DesignBody.tokens}.
 */
export interface DesignBody {
  type: "design";
  before: DesignScene;
  after: DesignScene;
  tokens?: TokenDelta[];
}

export type ArtifactBodyData =
  | GraphBody
  | DomainBody
  | WireframeBody
  | DesignBody;

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
  /**
   * Present when {@link ArtifactStatus} is `needs-input`: a question the agent
   * bubbled up for the developer to settle, answered by chatting with the agent
   * on the artifact's screen.
   */
  openQuestion?: string;
}

/** One concrete move in the implementation plan, drawn from the artifact diffs. */
export interface PlanStep {
  /** A short imperative title, e.g. "Add the ExportJob aggregate". */
  title: string;
  /** A sentence or two saying what to do and which artifact it comes from. */
  detail: string;
}

/**
 * The textual plan the synthesizer writes once the developer is done shaping the
 * artifacts. It reads the diffs across every surface together and turns them
 * into an ordered set of steps a coding agent (or the developer) can act on.
 */
export interface Plan {
  /** A short overview of what is being built and why. */
  overview: string;
  /** The implementation steps, sequenced the way you'd build them. */
  steps: PlanStep[];
}

/** A question an agent raised up to the orchestrator for the developer. */
export interface Decision {
  id: string;
  artifactId: string;
  from: ArtifactKind;
  question: string;
  resolved: boolean;
}

/**
 * What an agent did, recorded so the orchestrator feed keeps a durable trace of
 * background work rather than flashing a pill that vanishes when the work lands.
 * `research` and `draft` are lifecycle events; `decision-raised` and
 * `decision-resolved` bookend a {@link Decision} so the back-and-forth survives
 * after it is answered.
 */
export type ActivityKind =
  | "research"
  | "draft"
  | "decision-raised"
  | "decision-resolved";

export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  /** The surface this concerns, when it maps to one. */
  from?: ArtifactKind;
  /** Artifact to open when the entry is clicked; absent until one exists. */
  artifactId?: string;
  /** The decision this entry bookends, for raised and resolved events. */
  decisionId?: string;
  /** The line shown in the feed. */
  text: string;
  /** True while the work is still running; false once it has landed. */
  pending?: boolean;
  /** ISO 8601 timestamp. */
  at: string;
}

export interface Session {
  id: string;
  goal: string;
  /** The developer's conversation with the orchestrator. */
  conversation: ChatMessage[];
  artifacts: Artifact[];
  decisions: Decision[];
  /** A time-ordered log of what the agents did, surfaced in the feed. */
  activity?: ActivityEvent[];
  /**
   * The synthesized implementation plan, once the developer marks the scoping
   * done. Absent until then; regenerating replaces it.
   */
  plan?: Plan;
}

/** A chat message or an activity event, ready to render in the feed. */
export type FeedItem =
  | { type: "message"; at: string; message: ChatMessage }
  | { type: "activity"; at: string; activity: ActivityEvent };

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

/**
 * Merge the orchestrator conversation and the activity log into one feed.
 * Settled items — messages and finished activity — sort chronologically: ISO
 * 8601 timestamps sort lexically, so a plain string compare is chronological,
 * and the sort is stable so messages keep their place ahead of activity emitted
 * in the same tick. Activity still running (`pending`) is held at the end of the
 * feed, in start order, so an unfinished task stays pinned to the bottom until
 * it lands and drops back into the timeline where its timestamp belongs.
 */
export function activityFeed(session: Session): FeedItem[] {
  const items: FeedItem[] = [
    ...session.conversation.map(
      (message): FeedItem => ({ type: "message", at: message.at, message }),
    ),
    ...(session.activity ?? []).map(
      (activity): FeedItem => ({ type: "activity", at: activity.at, activity }),
    ),
  ];
  const byTime = (a: FeedItem, b: FeedItem) =>
    a.at < b.at ? -1 : a.at > b.at ? 1 : 0;
  const isPending = (item: FeedItem) =>
    item.type === "activity" && item.activity.pending === true;
  const settled = items.filter((item) => !isPending(item)).sort(byTime);
  const inProgress = items.filter(isPending).sort(byTime);
  return [...settled, ...inProgress];
}
