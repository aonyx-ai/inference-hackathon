import type {
  Artifact,
  ChatMessage,
  GraphBody,
  Plan,
} from "@inference-hackathon/core";
import { deriveEdges, type DomainModel } from "@inference-hackathon/domain";
import { API_BASE, toTurns } from "./planner";

/** The orchestrator's reply: its prose plus the two lifecycle cues it owns. */
export interface OrchestratorReply {
  text: string;
  /** True once the orchestrator judges the goal clear enough to draft artifacts. */
  ready: boolean;
  /** True once the developer has signaled to proceed; cues plan synthesis. */
  readyForPlan: boolean;
}

/**
 * Ask the orchestrator agent for its next reply. Posts the conversation so far
 * to the planner server and returns its prose plus the orchestrator's two cues:
 * whether the goal is now clear enough to fan out to the artifact agents, and
 * whether the developer has signaled scoping is done so the plan can be
 * synthesized. Throws with the server's message when generation fails — usually
 * a missing or rejected API key.
 */
export async function askOrchestrator(
  conversation: ChatMessage[],
): Promise<OrchestratorReply> {
  const response = await fetch(`${API_BASE}/api/orchestrator/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: toTurns(conversation) }),
  });

  const data = (await response.json()) as {
    text?: string;
    ready?: boolean;
    readyForPlan?: boolean;
    error?: string;
  };
  if (!response.ok) {
    throw new Error(
      data.error ?? `Orchestrator request failed (${response.status})`,
    );
  }
  return {
    text: data.text ?? "",
    ready: data.ready ?? false,
    readyForPlan: data.readyForPlan ?? false,
  };
}

/** The title the namer returns, before it lands as the session goal. */
interface TaskTitleResponse {
  title?: string;
  error?: string;
}

/**
 * Ask the task namer to distill an opening prompt into a short title for the
 * task header. Throws with the server's message on failure so the caller can
 * fall back to showing the raw prompt.
 */
export async function createTaskTitle(prompt: string): Promise<string> {
  const response = await fetch(`${API_BASE}/api/orchestrator/title`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });

  const data = (await response.json()) as TaskTitleResponse;
  if (!response.ok) {
    throw new Error(
      data.error ?? `Task title request failed (${response.status})`,
    );
  }
  return data.title ?? "";
}

/** One surface's findings from the repo-research stage, as the server sends them. */
export interface SurfaceFindings {
  summary: string;
  relevantPaths: { path: string; why: string }[];
  touchpoints: string[];
  conventions: string[];
  openQuestions: string[];
}

/** The grounding the research agents gathered, keyed by surface. */
export interface RepoContext {
  goal: string;
  root: string;
  surfaces: {
    architecture: SurfaceFindings;
    domain: SurfaceFindings;
    ux: SurfaceFindings;
  };
  error?: string;
}

/**
 * Run the repo-research stage: a group of Nemotron agents reads the working
 * directory and returns the grounding the artifact agents fold into their
 * prompts. The repository to explore is chosen by the server (it dogfoods on
 * its own checkout) unless `VITE_REPO_ROOT` names one. Throws with the server's
 * message on failure.
 */
export async function research(goal: string): Promise<RepoContext> {
  const root = import.meta.env.VITE_REPO_ROOT;
  const response = await fetch(`${API_BASE}/api/research`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(root ? { goal, root } : { goal }),
  });

  const data = (await response.json()) as RepoContext;
  if (!response.ok) {
    throw new Error(
      data.error ?? `Research request failed (${response.status})`,
    );
  }
  return data;
}

/**
 * Render one surface's findings as a prompt block for its artifact agent, so
 * the grounding the researcher gathered travels into the agent that proposes
 * the change. Empty sections are dropped.
 */
export function formatSurfaceContext(
  context: RepoContext,
  surface: keyof RepoContext["surfaces"],
): string {
  const findings = context.surfaces[surface];
  const lines = [
    `Repository context for the ${surface} surface (gathered by reading the actual code):`,
    "",
    `How it works today: ${findings.summary}`,
  ];
  if (findings.relevantPaths.length > 0) {
    lines.push(
      "",
      "Relevant paths:",
      ...findings.relevantPaths.map(
        (entry) => `  - ${entry.path}: ${entry.why}`,
      ),
    );
  }
  if (findings.touchpoints.length > 0) {
    lines.push("", `Likely touchpoints: ${findings.touchpoints.join("; ")}`);
  }
  if (findings.conventions.length > 0) {
    lines.push("", `Conventions to honor: ${findings.conventions.join("; ")}`);
  }
  if (findings.openQuestions.length > 0) {
    lines.push("", `Open questions: ${findings.openQuestions.join("; ")}`);
  }
  return lines.join("\n");
}

/**
 * Load the artifacts the planner reads from the codebase on disk. The server
 * shapes each into the artifact the UI renders — the domain model arrives as a
 * structured model the deck draws with Mermaid — so they pass straight through.
 * Throws with the server's message on failure.
 */
export async function fetchArtifacts(): Promise<Artifact[]> {
  const response = await fetch(`${API_BASE}/api/artifacts`);
  const data = (await response.json()) as {
    artifacts?: Artifact[];
    error?: string;
  };
  if (!response.ok) {
    throw new Error(
      data.error ?? `Artifacts request failed (${response.status})`,
    );
  }
  return data.artifacts ?? [];
}

/**
 * Ask the synthesizer to fold the finished artifacts into one implementation
 * plan. Posts the goal and each artifact's diff body to the planner server and
 * returns the overview and ordered steps. Throws with the server's message on
 * failure — usually a missing or rejected API key.
 */
export async function synthesizePlan(
  goal: string,
  artifacts: Artifact[],
): Promise<Plan> {
  const response = await fetch(`${API_BASE}/api/plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      goal,
      artifacts: artifacts.map((artifact) => ({
        kind: artifact.kind,
        title: artifact.title,
        summary: artifact.summary,
        body: artifact.body,
      })),
    }),
  });

  const data = (await response.json()) as Plan & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? `Plan request failed (${response.status})`);
  }
  return { overview: data.overview, steps: data.steps };
}

/** One artifact as the orchestrator's review sees it. */
export interface ReviewArtifactInput {
  id: string;
  kind: string;
  title: string;
  summary: string;
  digest: string;
}

/** What the webview posts for a review: the change and the artifacts it might touch. */
export interface ReviewInput {
  goal: string;
  changed: ReviewArtifactInput & { changeSummary: string };
  others: ReviewArtifactInput[];
}

/** An instruction the orchestrator aims at one other artifact's agent. */
export interface ReviewDirective {
  artifactId: string;
  instruction: string;
}

/** The orchestrator's verdict on a change: a note for the developer and directives. */
export interface Review {
  note: string;
  directives: ReviewDirective[];
}

/**
 * Render a graph as a compact one-line digest the orchestrator can reason over
 * without the full body — entity and component labels, plus the labeled edges
 * between them. Removed nodes and edges are dropped, since they no longer stand.
 */
export function graphDigest(body: GraphBody): string {
  const label = new Map(body.nodes.map((node) => [node.id, node.label]));
  const nodes = body.nodes
    .filter((node) => node.change !== "removed")
    .map((node) => node.label);
  const edges = body.edges
    .filter((edge) => edge.change !== "removed")
    .map((edge) => {
      const from = label.get(edge.from) ?? edge.from;
      const to = label.get(edge.to) ?? edge.to;
      return edge.label ? `${from} ${edge.label} ${to}` : `${from} → ${to}`;
    });
  const parts = [`nodes: ${nodes.join(", ") || "(none)"}`];
  if (edges.length > 0) parts.push(`edges: ${edges.join("; ")}`);
  return parts.join(" | ");
}

/**
 * Render a domain model as a compact one-line digest the orchestrator can reason
 * over, mirroring {@link graphDigest}: entity names plus the relationships
 * derived from their fields.
 */
export function modelDigest(model: DomainModel): string {
  const name = new Map(
    model.entities.map((entity) => [entity.id, entity.name]),
  );
  const entities = model.entities.map((entity) => entity.name);
  const edges = deriveEdges(model).map((edge) => {
    const from = name.get(edge.from) ?? edge.from;
    const to = name.get(edge.to) ?? edge.to;
    return edge.label ? `${from} ${edge.label} ${to}` : `${from} → ${to}`;
  });
  const parts = [`entities: ${entities.join(", ") || "(none)"}`];
  if (edges.length > 0) parts.push(`relationships: ${edges.join("; ")}`);
  return parts.join(" | ");
}

/**
 * Ask the orchestrator to review a change one artifact agent just made and decide
 * what it forces elsewhere. Returns the note to show the developer and the
 * directives to fan back out to the other agents. Throws with the server's
 * message on failure, so a failed review never silently swallows the change.
 */
export async function reviewArtifactChange(
  input: ReviewInput,
): Promise<Review> {
  const response = await fetch(`${API_BASE}/api/orchestrator/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const data = (await response.json()) as Review & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? `Review request failed (${response.status})`);
  }
  return { note: data.note ?? "", directives: data.directives ?? [] };
}
