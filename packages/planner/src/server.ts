import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { architectureEditSchema } from "./architecture-agent.ts";
import { generateArchitectureArtifact } from "./architecture.ts";
import { domainEditSchema } from "./domain-agent.ts";
import { withGraphContext } from "./graph-context.ts";
import { mastra } from "./mastra.ts";
import { parseMermaidClassDiagram } from "./mermaid-graph.ts";
import { researchRepo } from "./research.ts";
import { generateTaskTitle } from "./title.ts";

/**
 * A single turn in the chat, in the provider-agnostic shape the frontend sends.
 * The desktop app maps its author-tagged messages down to these roles before
 * posting, so the server never needs to know about artifacts.
 */
export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface OrchestratorChatRequest {
  messages: ChatTurn[];
}

/** The opening prompt the namer distills into a short task title. */
export interface TaskTitleRequest {
  prompt: string;
}

/** The goal the architecture modeler maps into the architecture artifact. */
export interface ArchitectureArtifactRequest {
  goal: string;
  /** Optional grounding from the repo-research stage, folded into the prompt. */
  context?: string;
}

/** The current domain-model graph the agent edits, sent alongside the chat. */
export interface DomainChatRequest {
  messages: ChatTurn[];
  body: { type: "graph"; nodes: unknown[]; edges: unknown[] };
}

/** Kick off the repo-research fan-out over a checkout on the local machine. */
export interface RepoResearchRequest {
  goal: string;
  /**
   * Absolute path to the repository the agents should explore. Optional: when
   * omitted the server falls back to `RESEARCH_REPO_ROOT` and finally its own
   * working directory, so the demo can dogfood on the repo the sidecar runs in
   * without the webview having to know a path.
   */
  root?: string;
}

/** Where to research when the request does not name a root. */
const DEFAULT_RESEARCH_ROOT = process.env.RESEARCH_REPO_ROOT ?? process.cwd();

const PORT = Number(process.env.PLANNER_PORT ?? 8787);

// Where the codebase being scoped lives. Its artifacts are read from its
// `docs/*.mmd` — Mermaid diagrams the codebase renders from its own model, which
// we parse into the editable graph the deck shows. Defaults to the working dir.
const CODEBASE_ROOT = process.env.CODEBASE_ROOT ?? process.cwd();
const ARTIFACTS_DIR = resolve(CODEBASE_ROOT, "docs");

const KINDS = ["architecture", "domain", "ux"] as const;
const KIND_TITLES: Record<(typeof KINDS)[number], string> = {
  architecture: "Architecture",
  domain: "Domain Model",
  ux: "User Experience",
};

const orchestrator = mastra.getAgent("orchestrator");
const domain = mastra.getAgent("domain");
const architecture = mastra.getAgent("architecture");

/**
 * Read every Mermaid artifact from the codebase's `docs` folder, parse each into
 * a graph the deck renders and the domain agent edits, and tag it by filename.
 * A missing folder is not an error — the codebase just has no artifacts yet.
 */
async function readArtifacts() {
  let entries: string[];
  try {
    entries = await readdir(ARTIFACTS_DIR);
  } catch {
    return [];
  }
  const files = entries.filter((name) => name.endsWith(".mmd")).sort();
  return Promise.all(
    files.map(async (name) => {
      const diagram = await readFile(join(ARTIFACTS_DIR, name), "utf8");
      const stem = name.slice(0, -".mmd".length);
      const kind = (KINDS as readonly string[]).includes(stem)
        ? (stem as (typeof KINDS)[number])
        : "domain";
      return {
        id: stem,
        kind,
        title: KIND_TITLES[kind],
        summary: "",
        status: "ready",
        conversation: [],
        body: { type: "graph", ...parseMermaidClassDiagram(diagram) },
      };
    }),
  );
}

function hasMessages(value: unknown): value is { messages: ChatTurn[] } {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { messages?: unknown }).messages)
  );
}

function isArchitectureRequest(
  value: unknown,
): value is ArchitectureArtifactRequest {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { goal?: unknown }).goal === "string"
  );
}

function isTitleRequest(value: unknown): value is TaskTitleRequest {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { prompt?: unknown }).prompt === "string"
  );
}

function isDomainChatRequest(value: unknown): value is DomainChatRequest {
  if (!hasMessages(value)) return false;
  const graph = (value as { body?: unknown }).body;
  return (
    typeof graph === "object" &&
    graph !== null &&
    (graph as { type?: unknown }).type === "graph" &&
    Array.isArray((graph as { nodes?: unknown }).nodes) &&
    Array.isArray((graph as { edges?: unknown }).edges)
  );
}

function isResearchRequest(value: unknown): value is RepoResearchRequest {
  if (typeof value !== "object" || value === null) return false;
  const root = (value as { root?: unknown }).root;
  return (
    typeof (value as { goal?: unknown }).goal === "string" &&
    (root === undefined || typeof root === "string")
  );
}

/**
 * Narrow each turn's role to a literal so it matches the AI SDK's discriminated
 * message union.
 */
function toModelMessages(turns: ChatTurn[]) {
  return turns.map((turn) =>
    turn.role === "user"
      ? ({ role: "user", content: turn.content } as const)
      : ({ role: "assistant", content: turn.content } as const),
  );
}

// In the dev server the webview reaches us through Vite's same-origin `/api`
// proxy, but a packaged build (or sidecar) calls this server cross-origin from
// the `tauri://localhost` webview, so every response carries permissive CORS
// headers and we answer preflight requests.
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: CORS_HEADERS });
}

/**
 * A tiny HTTP server that exposes the orchestrator agent to the webview. In dev
 * the Vite server proxies `/api` here; in a packaged build the webview calls it
 * directly. Either way the browser never sees an API key — the keys stay in this
 * process, loaded from `.env` by Bun.
 */
const server = Bun.serve({
  port: PORT,
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method === "GET" && url.pathname === "/api/health") {
      return json({ ok: true });
    }

    if (request.method === "GET" && url.pathname === "/api/artifacts") {
      try {
        return json({ artifacts: await readArtifacts() });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        console.error("Reading artifacts failed:", message);
        return json({ error: message }, 502);
      }
    }

    if (
      request.method === "POST" &&
      url.pathname === "/api/orchestrator/chat"
    ) {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }
      if (!hasMessages(body)) {
        return json({ error: "Expected { messages: ChatTurn[] }" }, 400);
      }

      try {
        const result = await orchestrator.generate(
          toModelMessages(body.messages),
        );
        return json({ text: result.text });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        console.error("Orchestrator generation failed:", message);
        return json({ error: message }, 502);
      }
    }

    // The opening prompt also gets distilled into a short task title for the
    // header, so the developer sees a clean heading rather than their raw text.
    if (
      request.method === "POST" &&
      url.pathname === "/api/orchestrator/title"
    ) {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }
      if (!isTitleRequest(body)) {
        return json({ error: "Expected { prompt: string }" }, 400);
      }

      try {
        const title = await generateTaskTitle(body.prompt);
        return json({ title });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        console.error("Task title generation failed:", message);
        return json({ error: message }, 502);
      }
    }

    // The orchestrator's first prompt also spins up an architecture artifact:
    // the architecture modeler maps the goal onto the components it touches.
    if (
      request.method === "POST" &&
      url.pathname === "/api/orchestrator/architecture"
    ) {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }
      if (!isArchitectureRequest(body)) {
        return json({ error: "Expected { goal: string }" }, 400);
      }

      try {
        const artifact = await generateArchitectureArtifact(
          body.goal,
          body.context,
        );
        return json(artifact);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        console.error("Architecture artifact generation failed:", message);
        return json({ error: message }, 502);
      }
    }

    // The domain-model agent edits a graph in place: it gets the current graph
    // plus the chat and returns a reply and the complete updated graph, which
    // the webview drops straight back into the artifact's body.
    if (request.method === "POST" && url.pathname === "/api/domain/chat") {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }
      if (!isDomainChatRequest(body)) {
        return json(
          { error: "Expected { messages: ChatTurn[], body: GraphBody }" },
          400,
        );
      }

      try {
        const result = await domain.generate(
          toModelMessages(withGraphContext(body.body, body.messages)),
          { structuredOutput: { schema: domainEditSchema } },
        );
        const edit = result.object;
        return json({
          text: edit.reply,
          body: { type: "graph", nodes: edit.nodes, edges: edit.edges },
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        console.error("Domain agent generation failed:", message);
        return json({ error: message }, 502);
      }
    }

    // The architecture agent edits its map in place, mirroring the domain chat:
    // current graph plus chat in, a reply and the complete updated graph out.
    if (
      request.method === "POST" &&
      url.pathname === "/api/architecture/chat"
    ) {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }
      if (!isDomainChatRequest(body)) {
        return json(
          { error: "Expected { messages: ChatTurn[], body: GraphBody }" },
          400,
        );
      }

      try {
        const result = await architecture.generate(
          toModelMessages(
            withGraphContext(body.body, body.messages, "architecture map"),
          ),
          { structuredOutput: { schema: architectureEditSchema } },
        );
        const edit = result.object;
        return json({
          text: edit.reply,
          body: { type: "graph", nodes: edit.nodes, edges: edit.edges },
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        console.error("Architecture agent generation failed:", message);
        return json({ error: message }, 502);
      }
    }

    // The repo-research stage: a group of Nemotron agents reads the checkout at
    // `root` and returns the grounding the artifact agents fold into their
    // prompts. It runs after the developer states the change and before the
    // artifact agents propose it.
    if (request.method === "POST" && url.pathname === "/api/research") {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }
      if (!isResearchRequest(body)) {
        return json({ error: "Expected { goal: string, root?: string }" }, 400);
      }

      try {
        const context = await researchRepo(
          body.goal,
          body.root ?? DEFAULT_RESEARCH_ROOT,
        );
        return json(context);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        console.error("Repo research failed:", message);
        return json({ error: message }, 502);
      }
    }

    return new Response("Not found", { status: 404, headers: CORS_HEADERS });
  },
});

console.log(`Planner server listening on http://localhost:${server.port}`);
