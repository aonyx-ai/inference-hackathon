import { mastra } from "./mastra.ts";
import { generateDomainArtifact } from "./domain.ts";

/**
 * A single turn in the orchestrator chat, in the provider-agnostic shape the
 * frontend sends. The desktop app maps its author-tagged messages down to these
 * roles before posting, so the server never needs to know about artifacts.
 */
export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface OrchestratorChatRequest {
  messages: ChatTurn[];
}

export interface DomainArtifactRequest {
  goal: string;
}

const PORT = Number(process.env.PLANNER_PORT ?? 8787);

const orchestrator = mastra.getAgent("orchestrator");

function isChatRequest(value: unknown): value is OrchestratorChatRequest {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { messages?: unknown }).messages)
  );
}

function isDomainRequest(value: unknown): value is DomainArtifactRequest {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { goal?: unknown }).goal === "string"
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
      if (!isChatRequest(body)) {
        return json({ error: "Expected { messages: ChatTurn[] }" }, 400);
      }

      try {
        // Narrow each turn's role to a literal so it matches the AI SDK's
        // discriminated message union.
        const messages = body.messages.map((turn) =>
          turn.role === "user"
            ? ({ role: "user", content: turn.content } as const)
            : ({ role: "assistant", content: turn.content } as const),
        );
        const result = await orchestrator.generate(messages);
        return json({ text: result.text });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        console.error("Orchestrator generation failed:", message);
        return json({ error: message }, 502);
      }
    }

    if (
      request.method === "POST" &&
      url.pathname === "/api/orchestrator/domain"
    ) {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return json({ error: "Invalid JSON body" }, 400);
      }
      if (!isDomainRequest(body)) {
        return json({ error: "Expected { goal: string }" }, 400);
      }

      try {
        const artifact = await generateDomainArtifact(body.goal);
        return json(artifact);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        console.error("Domain artifact generation failed:", message);
        return json({ error: message }, 502);
      }
    }

    return new Response("Not found", { status: 404, headers: CORS_HEADERS });
  },
});

console.log(`Planner server listening on http://localhost:${server.port}`);
