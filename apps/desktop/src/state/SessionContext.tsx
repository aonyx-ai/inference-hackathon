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
import { askOrchestrator } from "../api/orchestrator";

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
  /** Send a message to the orchestrator on the orchestration screen. */
  sendToOrchestrator: (text: string) => void;
  /** Send a message to a single artifact's agent on its screen. */
  sendToArtifactAgent: (artifactId: string, text: string) => void;
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

  // The latest committed session, readable synchronously after an `await`
  // without closing over a stale render.
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const sendToOrchestrator = useCallback((text: string) => {
    const userMessage = makeMessage("user", text);
    const conversation = appendMessage(
      sessionRef.current.conversation,
      userMessage,
    );
    setSession((current) => ({
      ...current,
      // The opening message states the task, so it becomes the session goal.
      goal: current.goal || text,
      conversation: appendMessage(current.conversation, userMessage),
    }));

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
      setSession((current) => ({
        ...current,
        artifacts: current.artifacts.map(
          (artifact): Artifact =>
            artifact.id === artifactId
              ? {
                  ...artifact,
                  conversation: appendMessage(
                    artifact.conversation,
                    makeMessage("user", text),
                  ),
                }
              : artifact,
        ),
      }));
    },
    [],
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
      sendToOrchestrator,
      sendToArtifactAgent,
      resolveDecision,
    }),
    [
      session,
      orchestratorPending,
      sendToOrchestrator,
      sendToArtifactAgent,
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
