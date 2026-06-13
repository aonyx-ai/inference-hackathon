import {
  createContext,
  useCallback,
  useContext,
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
  createDomainArtifact,
  createTaskTitle,
  formatSurfaceContext,
  research,
} from "../api/orchestrator";
import { askDomainAgent } from "../api/artifactAgent";

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
  /** True while the domain modeler is drafting the first artifact. */
  domainPending: boolean;
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
}: {
  children: ReactNode;
  /** Seed state, used by tests; the app starts from an empty session. */
  initialSession?: Session;
}) {
  const [session, setSession] = useState<Session>(initialSession);
  const [orchestratorPending, setOrchestratorPending] = useState(false);
  const [researchPending, setResearchPending] = useState(false);
  const [domainPending, setDomainPending] = useState(false);
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

  const sendToOrchestrator = useCallback((text: string) => {
    const userMessage = makeMessage("user", text);
    const isFirstMessage = sessionRef.current.conversation.length === 0;
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

    // The opening prompt also kicks off the first artifact. First a group of
    // research agents reads the repo to learn how it works; their domain context
    // then grounds the domain modeler, whose graph lands in the deck. Research
    // can fail (no key, no repo) — the artifact is still drafted, just from the
    // prompt alone.
    if (isFirstMessage) {
      // Distill the prompt into a short task title that replaces the verbatim
      // text once it returns; on failure the prompt simply stays as the goal.
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

      setResearchPending(true);
      setDomainPending(true);
      void research(text)
        .then((context) => formatSurfaceContext(context, "domain"))
        .catch((error: unknown) => {
          console.error("Repo research failed:", error);
          return undefined;
        })
        .finally(() => setResearchPending(false))
        .then((domainContext) => createDomainArtifact(text, domainContext))
        .then((artifact) => {
          setSession((current) => ({
            ...current,
            artifacts: [...current.artifacts, artifact],
          }));
        })
        .catch((error: unknown) => {
          console.error("Domain artifact generation failed:", error);
        })
        .finally(() => setDomainPending(false));
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
  }, []);

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

      // Only the domain model — a diffable graph — has an agent wired up so far.
      // Other surfaces still just record the message until their agents land.
      if (artifact.body.type !== "graph") return;
      const graph = artifact.body;
      const kind = artifact.kind;

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
      void askDomainAgent(graph, conversation)
        .then((result) => reply(makeMessage(kind, result.text), result.body))
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
      domainPending,
      sendToOrchestrator,
      sendToArtifactAgent,
      artifactPending,
      resolveDecision,
    }),
    [
      session,
      orchestratorPending,
      researchPending,
      domainPending,
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
