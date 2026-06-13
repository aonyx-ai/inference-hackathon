import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Artifact, ChatMessage, Session } from "@inference-hackathon/core";
import { mockSession } from "../data/mockSession";

interface SessionContextValue {
  session: Session;
  /** Send a message to the orchestrator on the orchestration screen. */
  sendToOrchestrator: (text: string) => void;
  /** Send a message to a single artifact's agent on its screen. */
  sendToArtifactAgent: (artifactId: string, text: string) => void;
  /** Mark a raised decision as answered. */
  resolveDecision: (decisionId: string) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

let messageCounter = 0;
function nextId(): string {
  messageCounter += 1;
  return `local-${messageCounter}`;
}

function appendMessage(messages: ChatMessage[], message: ChatMessage) {
  return [...messages, message];
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>(mockSession);

  const sendToOrchestrator = useCallback((text: string) => {
    setSession((current) => ({
      ...current,
      conversation: appendMessage(current.conversation, {
        id: nextId(),
        author: "user",
        text,
        at: new Date().toISOString(),
      }),
    }));
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
                  conversation: appendMessage(artifact.conversation, {
                    id: nextId(),
                    author: "user",
                    text,
                    at: new Date().toISOString(),
                  }),
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
      sendToOrchestrator,
      sendToArtifactAgent,
      resolveDecision,
    }),
    [session, sendToOrchestrator, sendToArtifactAgent, resolveDecision],
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
