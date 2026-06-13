import type { Artifact, ChatMessage } from "@inference-hackathon/core";
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
 * parses each Mermaid diagram into the graph shape the UI renders, so they pass
 * straight through. Throws with the server's message on failure.
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
