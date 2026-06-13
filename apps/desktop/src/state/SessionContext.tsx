import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  Artifact,
  Author,
  ChatMessage,
  Session,
} from "@inference-hackathon/core";
import { findArtifact } from "@inference-hackathon/core";
import {
  askOrchestrator,
  createArchitectureArtifact,
  createTaskTitle,
  fetchArtifacts,
  formatSurfaceContext,
  research,
} from "../api/orchestrator";
import {
  askArchitectureAgent,
  askDomainAgent,
  type ArtifactAgentReply,
} from "../api/artifactAgent";
import { designDemoArtifact } from "../data/designDemo";

/** A fresh session with nothing in it; the orchestrator fills it as you talk. */
const emptySession: Session = {
  id: "session",
  goal: "",
  conversation: [],
  artifacts: [],
  decisions: [],
};

interface SessionContextValue {
  session: Session;
  /** True while the orchestrator is generating a reply. */
  orchestratorPending: boolean;
  /** True while the research agents are reading the repo to ground the artifacts. */
  researchPending: boolean;
  /** True while the architecture modeler is drafting the architecture artifact. */
  architecturePending: boolean;
  /** Send a message to the orchestrator on the orchestration screen. */
  sendToOrchestrator: (text: string) => void;
  /** Send a message to a single artifact's agent on its screen. */
  sendToArtifactAgent: (artifactId: string, text: string) => void;
  /** True while a given artifact's agent is generating a reply. */
  artifactPending: (artifactId: string) => boolean;
  /** Mark a raised decision as answered. */
  resolveDecision: (decisionId: string) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

let messageCounter = 0;
function makeMessage(author: Author, text: string): ChatMessage {
  messageCounter += 1;
  return {
    id: `local-${messageCounter}`,
    author,
    text,
    at: new Date().toISOString(),
  };
}

function appendMessage(messages: ChatMessage[], message: ChatMessage) {
  return [...messages, message];
}

export function SessionProvider({
  children,
  initialSession = emptySession,
  autoLoad = true,
}: {
  children: ReactNode;
  /** Seed state, used by tests; the app starts from an empty session. */
  initialSession?: Session;
  /** Load artifacts from the planner on mount; tests turn this off. */
  autoLoad?: boolean;
}) {
  const [session, setSession] = useState<Session>(initialSession);
  const [orchestratorPending, setOrchestratorPending] = useState(false);
  const [researchPending, setResearchPending] = useState(false);
  const [architecturePending, setArchitecturePending] = useState(false);
  // Ids of artifacts whose agent is mid-reply, so each screen can show its own
  // pending state without blocking the others.
  const [pendingArtifacts, setPendingArtifacts] = useState<Set<string>>(
    () => new Set(),
  );

  const setArtifactPending = useCallback((artifactId: string, on: boolean) => {
    setPendingArtifacts((current) => {
      const next = new Set(current);
      if (on) next.add(artifactId);
      else next.delete(artifactId);
      return next;
    });
  }, []);

  // The latest committed session, readable synchronously after an `await`
  // without closing over a stale render.
  const sessionRef = useRef(session);
  sessionRef.current = session;

  // The artifacts live on disk in the codebase being scoped; the planner reads
  // them and we pull them into the deck when the session opens. From there the
  // domain artifact is iterated on through its own agent. The UX design artifact
  // is seeded alongside them — canned until a UX agent can emit one — so the
  // side-by-side design surface is visible in the deck.
  useEffect(() => {
    if (!autoLoad) return;
    void fetchArtifacts()
      .then((artifacts) => {
        setSession((current) => ({
          ...current,
          artifacts: [...artifacts, designDemoArtifact],
        }));
      })
      .catch((error: unknown) => {
        console.error("Loading artifacts failed:", error);
      });
  }, [autoLoad]);

  const sendToOrchestrator = useCallback(
    (text: string) => {
      const userMessage = makeMessage("user", text);
      const isFirstMessage = sessionRef.current.conversation.length === 0;
      const domainArtifact = sessionRef.current.artifacts.find(
        (artifact) =>
          artifact.kind === "domain" && artifact.body.type === "graph",
      );
      const conversation = appendMessage(
        sessionRef.current.conversation,
        userMessage,
      );
      setSession((current) => ({
        ...current,
        // The opening message states the task, so it seeds the session goal. It
        // shows verbatim at first, then the namer swaps in a short title below.
        goal: current.goal || text,
        conversation: appendMessage(current.conversation, userMessage),
      }));

      if (isFirstMessage) {
        // Distill the prompt into a short task title that replaces the verbatim
        // text once it returns; on failure the prompt stays as the goal.
        void createTaskTitle(text)
          .then((title) => {
            const trimmed = title.trim();
            if (trimmed) {
              setSession((current) => ({ ...current, goal: trimmed }));
            }
          })
          .catch((error: unknown) => {
            console.error("Task title generation failed:", error);
          });

        // Research the repo once; its per-surface context grounds both the
        // domain edit and the architecture draft. Research can fail (no key, no
        // repo) — each still proceeds from the task alone.
        setResearchPending(true);
        const repoContext = research(text)
          .catch((error: unknown) => {
            console.error("Repo research failed:", error);
            return undefined;
          })
          .finally(() => setResearchPending(false));

        // Domain: the model loaded from disk, so the prompt grounds and edits
        // the graph already in the deck rather than drafting a new one.
        if (domainArtifact && domainArtifact.body.type === "graph") {
          const graph = domainArtifact.body;
          const artifactId = domainArtifact.id;
          setArtifactPending(artifactId, true);
          void repoContext
            .then((context) =>
              context ? formatSurfaceContext(context, "domain") : undefined,
            )
            .then((domainContext) => {
              const request =
                (domainContext ? `${domainContext}\n\n` : "") +
                `The developer's task: ${text}\n\nUpdate the domain model to reflect this task.`;
              return askDomainAgent(graph, [makeMessage("user", request)]);
            })
            .then((result) => {
              setSession((current) => ({
                ...current,
                artifacts: current.artifacts.map(
                  (item): Artifact =>
                    item.id === artifactId
                      ? {
                          ...item,
                          body: result.body,
                          status: "ready",
                          conversation: appendMessage(
                            item.conversation,
                            makeMessage("domain", result.text),
                          ),
                        }
                      : item,
                ),
              }));
            })
            .catch((error: unknown) => {
              console.error("Grounding the domain artifact failed:", error);
            })
            .finally(() => setArtifactPending(artifactId, false));
        }

        // Architecture: the same research grounds the architecture modeler,
        // whose graph lands in the deck when it finishes.
        setArchitecturePending(true);
        void repoContext
          .then((context) =>
            createArchitectureArtifact(
              text,
              context
                ? formatSurfaceContext(context, "architecture")
                : undefined,
            ),
          )
          .then((artifact) =>
            setSession((current) => ({
              ...current,
              artifacts: [...current.artifacts, artifact],
            })),
          )
          .catch((error: unknown) => {
            console.error("Architecture artifact generation failed:", error);
          })
          .finally(() => setArchitecturePending(false));
      }

      setOrchestratorPending(true);
      void askOrchestrator(conversation)
        .then((reply) => {
          setSession((current) => ({
            ...current,
            conversation: appendMessage(
              current.conversation,
              makeMessage("orchestrator", reply),
            ),
          }));
        })
        .catch((error: unknown) => {
          const message =
            error instanceof Error ? error.message : "Something went wrong";
          setSession((current) => ({
            ...current,
            conversation: appendMessage(
              current.conversation,
              makeMessage("orchestrator", `⚠️ ${message}`),
            ),
          }));
        })
        .finally(() => setOrchestratorPending(false));
    },
    [setArtifactPending],
  );

  const sendToArtifactAgent = useCallback(
    (artifactId: string, text: string) => {
      const artifact = findArtifact(sessionRef.current, artifactId);
      if (!artifact) return;

      const userMessage = makeMessage("user", text);
      const conversation = appendMessage(artifact.conversation, userMessage);
      setSession((current) => ({
        ...current,
        artifacts: current.artifacts.map((item) =>
          item.id === artifactId
            ? {
                ...item,
                conversation: appendMessage(item.conversation, userMessage),
              }
            : item,
        ),
      }));

      // The two diffable graphs — the domain model and the architecture map —
      // each have an agent that edits them in place. Other surfaces still just
      // record the message until their agents land.
      if (artifact.body.type !== "graph") return;
      const graph = artifact.body;
      const kind = artifact.kind;
      const ask: Record<string, typeof askDomainAgent> = {
        domain: askDomainAgent,
        architecture: askArchitectureAgent,
      };
      const askAgent = ask[kind];
      if (!askAgent) return;

      const reply = (message: ChatMessage, body?: Artifact["body"]) =>
        setSession((current) => ({
          ...current,
          artifacts: current.artifacts.map(
            (item): Artifact =>
              item.id === artifactId
                ? {
                    ...item,
                    conversation: appendMessage(item.conversation, message),
                    ...(body
                      ? { body, status: "ready", staleReason: undefined }
                      : {}),
                  }
                : item,
          ),
        }));

      setArtifactPending(artifactId, true);
      void askAgent(graph, conversation)
        .then((result: ArtifactAgentReply) =>
          reply(makeMessage(kind, result.text), result.body),
        )
        .catch((error: unknown) => {
          const message =
            error instanceof Error ? error.message : "Something went wrong";
          reply(makeMessage(kind, `⚠️ ${message}`));
        })
        .finally(() => setArtifactPending(artifactId, false));
    },
    [setArtifactPending],
  );

  const artifactPending = useCallback(
    (artifactId: string) => pendingArtifacts.has(artifactId),
    [pendingArtifacts],
  );

  const resolveDecision = useCallback((decisionId: string) => {
    setSession((current) => ({
      ...current,
      decisions: current.decisions.map((decision) =>
        decision.id === decisionId ? { ...decision, resolved: true } : decision,
      ),
    }));
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      orchestratorPending,
      researchPending,
      architecturePending,
      sendToOrchestrator,
      sendToArtifactAgent,
      artifactPending,
      resolveDecision,
    }),
    [
      session,
      orchestratorPending,
      researchPending,
      architecturePending,
      sendToOrchestrator,
      sendToArtifactAgent,
      artifactPending,
      resolveDecision,
    ],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return value;
}
