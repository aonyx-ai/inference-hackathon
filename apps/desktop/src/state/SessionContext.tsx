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
  ActivityEvent,
  Artifact,
  Author,
  ChatMessage,
  Decision,
  GraphBody,
  Session,
} from "@inference-hackathon/core";
import { findArtifact } from "@inference-hackathon/core";
import {
  askOrchestrator,
  createTaskTitle,
  fetchArtifacts,
  formatSurfaceContext,
  graphDigest,
  research,
  reviewArtifactChange,
  synthesizePlan,
  type Review,
  type ReviewArtifactInput,
} from "../api/orchestrator";
import { askArchitectureAgent, askDomainAgent } from "../api/artifactAgent";
import { designDemoArtifact } from "../data/designDemo";

/**
 * How deep a single change is allowed to cascade. A developer edit (depth 0) can
 * prompt other agents to rethink (depth 1), and those rethinks can ripple once
 * more (depth 2) before the chain stops. The `visited` set already prevents two
 * surfaces from prompting each other forever; this is a backstop.
 */
const MAX_CASCADE_DEPTH = 2;

/** Asks a graph artifact agent to edit its graph; domain and architecture share this shape. */
type AskArtifactAgent = typeof askDomainAgent;

/**
 * The editing agent for an artifact kind, or undefined for kinds without one
 * (the wireframe and design surfaces). Resolved lazily by kind so a test that
 * mocks only one agent never trips over the other's binding at module load.
 */
function agentFor(kind: string): AskArtifactAgent | undefined {
  if (kind === "domain") return askDomainAgent;
  if (kind === "architecture") return askArchitectureAgent;
  return undefined;
}

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
  /** True while the orchestrator is reviewing a change to decide what it ripples to. */
  orchestratorReviewing: boolean;
  /** True while the synthesizer is folding the artifacts into a plan. */
  planPending: boolean;
  /** Send a message to the orchestrator on the orchestration screen. */
  sendToOrchestrator: (text: string) => void;
  /** Send a message to a single artifact's agent on its screen. */
  sendToArtifactAgent: (artifactId: string, text: string) => void;
  /** True while a given artifact's agent is generating a reply. */
  artifactPending: (artifactId: string) => boolean;
  /** Raise an agent's question to the orchestrator, logged to the feed. */
  raiseDecision: (decision: Omit<Decision, "resolved">) => void;
  /** Mark a raised decision as answered, logged to the feed. */
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

let activityCounter = 0;
function makeActivity(
  kind: ActivityEvent["kind"],
  text: string,
  extra: Partial<Omit<ActivityEvent, "id" | "kind" | "text" | "at">> = {},
): ActivityEvent {
  activityCounter += 1;
  return {
    id: `activity-${activityCounter}`,
    kind,
    text,
    at: new Date().toISOString(),
    ...extra,
  };
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
  const [reviewPending, setReviewPending] = useState(false);
  const [planPending, setPlanPending] = useState(false);
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

  // Append an event to the activity log, and update one in place as its work
  // lands (flipping `pending` off, rewriting its line, attaching an artifact).
  const addActivity = useCallback((event: ActivityEvent) => {
    setSession((current) => ({
      ...current,
      activity: [...(current.activity ?? []), event],
    }));
  }, []);

  const patchActivity = useCallback(
    (id: string, patch: Partial<ActivityEvent>) => {
      setSession((current) => ({
        ...current,
        activity: (current.activity ?? []).map((event) =>
          event.id === id ? { ...event, ...patch } : event,
        ),
      }));
    },
    [],
  );

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

  // Fold every artifact's diff into one textual plan. This isn't a button the
  // developer presses — the orchestrator reads from the conversation that they
  // are satisfied and calls this, so the plan just appears below the deck.
  // Failures surface as an orchestrator message, like any other reply.
  const synthesizePlanFromArtifacts = useCallback(() => {
    const { goal, artifacts } = sessionRef.current;
    if (artifacts.length === 0) return;

    setPlanPending(true);
    void synthesizePlan(goal, artifacts)
      .then((plan) => {
        setSession((current) => ({ ...current, plan }));
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : "Something went wrong";
        setSession((current) => ({
          ...current,
          conversation: appendMessage(
            current.conversation,
            makeMessage(
              "orchestrator",
              `⚠️ Couldn't synthesize a plan: ${message}`,
            ),
          ),
        }));
      })
      .finally(() => setPlanPending(false));
  }, []);

  const sendToOrchestrator = useCallback(
    (text: string) => {
      const userMessage = makeMessage("user", text);
      const isFirstMessage = sessionRef.current.conversation.length === 0;
      const domainArtifact = sessionRef.current.artifacts.find(
        (artifact) =>
          artifact.kind === "domain" && artifact.body.type === "graph",
      );
      const architectureArtifact = sessionRef.current.artifacts.find(
        (artifact) =>
          artifact.kind === "architecture" && artifact.body.type === "graph",
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
        const researchEvent = makeActivity(
          "research",
          "Reading the repository with Nemotron…",
          { pending: true },
        );
        addActivity(researchEvent);
        setResearchPending(true);
        const repoContext = research(text)
          .then((context) => {
            patchActivity(researchEvent.id, {
              pending: false,
              text: "Read the repository to ground the agents",
            });
            return context;
          })
          .catch((error: unknown) => {
            console.error("Repo research failed:", error);
            patchActivity(researchEvent.id, {
              pending: false,
              text: "Repository research didn't complete",
            });
            return undefined;
          })
          .finally(() => setResearchPending(false));

        // Domain: the model loaded from disk, so the prompt grounds and edits
        // the graph already in the deck rather than drafting a new one.
        if (domainArtifact && domainArtifact.body.type === "graph") {
          const graph = domainArtifact.body;
          const artifactId = domainArtifact.id;
          const draftEvent = makeActivity(
            "draft",
            "Grounding the domain model in the task…",
            { pending: true, from: "domain", artifactId },
          );
          addActivity(draftEvent);
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
              patchActivity(draftEvent.id, {
                pending: false,
                text: "Updated the domain model to reflect the task",
              });
            })
            .catch((error: unknown) => {
              console.error("Grounding the domain artifact failed:", error);
              patchActivity(draftEvent.id, {
                pending: false,
                text: "Couldn't update the domain model",
              });
            })
            .finally(() => setArtifactPending(artifactId, false));
        }

        // Architecture: also loaded from disk, so the same research grounds an
        // edit of the dependency graph already in the deck.
        if (
          architectureArtifact &&
          architectureArtifact.body.type === "graph"
        ) {
          const graph = architectureArtifact.body;
          const artifactId = architectureArtifact.id;
          const draftEvent = makeActivity(
            "draft",
            "Grounding the architecture in the task…",
            { pending: true, from: "architecture", artifactId },
          );
          addActivity(draftEvent);
          setArtifactPending(artifactId, true);
          void repoContext
            .then((context) =>
              context
                ? formatSurfaceContext(context, "architecture")
                : undefined,
            )
            .then((archContext) => {
              const request =
                (archContext ? `${archContext}\n\n` : "") +
                `The developer's task: ${text}\n\nUpdate the architecture to reflect this task.`;
              return askArchitectureAgent(graph, [
                makeMessage("user", request),
              ]);
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
                            makeMessage("architecture", result.text),
                          ),
                        }
                      : item,
                ),
              }));
              patchActivity(draftEvent.id, {
                pending: false,
                text: "Updated the architecture to reflect the task",
              });
            })
            .catch((error: unknown) => {
              console.error(
                "Grounding the architecture artifact failed:",
                error,
              );
              patchActivity(draftEvent.id, {
                pending: false,
                text: "Couldn't update the architecture",
              });
            })
            .finally(() => setArtifactPending(artifactId, false));
        }
      }

      setOrchestratorPending(true);
      void askOrchestrator(conversation)
        .then((reply) => {
          setSession((current) => ({
            ...current,
            conversation: appendMessage(
              current.conversation,
              makeMessage("orchestrator", reply.text),
            ),
          }));
          // The orchestrator decides when scoping is done; when it says so, the
          // plan synthesizes off the artifacts on hand.
          if (reply.readyForPlan) synthesizePlanFromArtifacts();
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
    [
      setArtifactPending,
      addActivity,
      patchActivity,
      synthesizePlanFromArtifacts,
    ],
  );

  // A snapshot of one artifact in the shape the orchestrator's review reasons
  // over: identity, intent, and a compact digest of its current graph.
  const reviewInputFor = useCallback(
    (artifact: Artifact): ReviewArtifactInput | null =>
      artifact.body.type === "graph" && agentFor(artifact.kind)
        ? {
            id: artifact.id,
            kind: artifact.kind,
            title: artifact.title,
            summary: artifact.summary,
            digest: graphDigest(artifact.body),
          }
        : null,
    [],
  );

  // Run one agent turn against a graph artifact: show the prompt in its thread,
  // ask the agent, then fold its reply, its edited graph, and any question it
  // raised back into state. A developer prompt answers any open question; an
  // orchestrator directive leaves the artifact marked stale while it reworks.
  // Returns the new graph and the reply, or null when there's no agent or it
  // errored.
  const runAgentTurn = useCallback(
    async (
      artifactId: string,
      prompt: ChatMessage,
      staleReason?: string,
    ): Promise<{ body: GraphBody; reply: string } | null> => {
      const artifact = findArtifact(sessionRef.current, artifactId);
      if (!artifact || artifact.body.type !== "graph") return null;
      const askAgent = agentFor(artifact.kind);
      if (!askAgent) return null;

      const graph = artifact.body;
      const kind = artifact.kind;
      // The model always sees the prompt as the actionable user request, even
      // when the orchestrator authored it in the thread, so the agent acts on it.
      const modelConversation = appendMessage(
        artifact.conversation,
        makeMessage("user", prompt.text),
      );

      setSession((current) => ({
        ...current,
        artifacts: current.artifacts.map(
          (item): Artifact =>
            item.id === artifactId
              ? {
                  ...item,
                  conversation: appendMessage(item.conversation, prompt),
                  ...(prompt.author === "user"
                    ? { openQuestion: undefined }
                    : {}),
                  ...(staleReason ? { status: "stale", staleReason } : {}),
                }
              : item,
        ),
      }));

      setArtifactPending(artifactId, true);
      try {
        const result = await askAgent(graph, modelConversation);
        setSession((current) => ({
          ...current,
          artifacts: current.artifacts.map(
            (item): Artifact =>
              item.id === artifactId
                ? {
                    ...item,
                    conversation: appendMessage(
                      item.conversation,
                      makeMessage(kind, result.text),
                    ),
                    body: result.body,
                    status: result.raise ? "needs-input" : "ready",
                    staleReason: undefined,
                    openQuestion: result.raise,
                  }
                : item,
          ),
        }));
        return { body: result.body, reply: result.text };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Something went wrong";
        setSession((current) => ({
          ...current,
          artifacts: current.artifacts.map(
            (item): Artifact =>
              item.id === artifactId
                ? {
                    ...item,
                    conversation: appendMessage(
                      item.conversation,
                      makeMessage(kind, `⚠️ ${message}`),
                    ),
                  }
                : item,
          ),
        }));
        return null;
      } finally {
        setArtifactPending(artifactId, false);
      }
    },
    [setArtifactPending],
  );

  // After a change, ask the orchestrator what it forces elsewhere, narrate its
  // verdict in the main thread, and fan its directives back out to the other
  // agents — each of which can ripple once more. `visited` stops two surfaces
  // from prompting each other forever; the depth cap is a backstop.
  const propagateChange = useCallback(
    async (
      changed: ReviewArtifactInput & { changeSummary: string },
      visited: Set<string>,
      depth: number,
    ): Promise<void> => {
      const others = sessionRef.current.artifacts
        .filter((item) => !visited.has(item.id))
        .map(reviewInputFor)
        .filter((item): item is ReviewArtifactInput => item !== null);
      if (others.length === 0) return;

      setReviewPending(true);
      let review: Review | null = null;
      try {
        review = await reviewArtifactChange({
          goal: sessionRef.current.goal,
          changed,
          others,
        });
      } catch (error) {
        console.error("Orchestrator review failed:", error);
      } finally {
        setReviewPending(false);
      }
      if (!review) return;

      if (review.note.trim()) {
        setSession((current) => ({
          ...current,
          conversation: appendMessage(
            current.conversation,
            makeMessage("orchestrator", review.note),
          ),
        }));
      }
      if (depth >= MAX_CASCADE_DEPTH) return;

      const directives = review.directives.filter(
        (directive) =>
          !visited.has(directive.artifactId) &&
          findArtifact(sessionRef.current, directive.artifactId),
      );
      await Promise.all(
        directives.map(async (directive) => {
          visited.add(directive.artifactId);
          const result = await runAgentTurn(
            directive.artifactId,
            makeMessage("orchestrator", directive.instruction),
            directive.instruction,
          );
          if (!result) return;
          const target = findArtifact(sessionRef.current, directive.artifactId);
          if (!target) return;
          await propagateChange(
            {
              id: target.id,
              kind: target.kind,
              title: target.title,
              summary: target.summary,
              digest: graphDigest(result.body),
              changeSummary: result.reply,
            },
            visited,
            depth + 1,
          );
        }),
      );
    },
    [reviewInputFor, runAgentTurn],
  );

  const sendToArtifactAgent = useCallback(
    (artifactId: string, text: string) => {
      const artifact = findArtifact(sessionRef.current, artifactId);
      if (!artifact) return;

      // Surfaces without an editing agent (the wireframe and design) just record
      // the turn.
      if (artifact.body.type !== "graph" || !agentFor(artifact.kind)) {
        setSession((current) => ({
          ...current,
          artifacts: current.artifacts.map((item) =>
            item.id === artifactId
              ? {
                  ...item,
                  conversation: appendMessage(
                    item.conversation,
                    makeMessage("user", text),
                  ),
                }
              : item,
          ),
        }));
        return;
      }

      const meta = {
        id: artifact.id,
        kind: artifact.kind,
        title: artifact.title,
        summary: artifact.summary,
      };
      void runAgentTurn(artifactId, makeMessage("user", text)).then(
        (result) => {
          if (!result) return;
          // The developer's edit lands first; then the orchestrator reviews it
          // and the change ripples out to the other surfaces.
          return propagateChange(
            {
              ...meta,
              digest: graphDigest(result.body),
              changeSummary: result.reply,
            },
            new Set([artifactId]),
            0,
          );
        },
      );
    },
    [propagateChange, runAgentTurn],
  );

  const artifactPending = useCallback(
    (artifactId: string) => pendingArtifacts.has(artifactId),
    [pendingArtifacts],
  );

  const raiseDecision = useCallback((decision: Omit<Decision, "resolved">) => {
    const raised = makeActivity("decision-raised", decision.question, {
      from: decision.from,
      artifactId: decision.artifactId,
      decisionId: decision.id,
    });
    setSession((current) => ({
      ...current,
      decisions: [...current.decisions, { ...decision, resolved: false }],
      activity: [...(current.activity ?? []), raised],
    }));
  }, []);

  const resolveDecision = useCallback((decisionId: string) => {
    const decision = sessionRef.current.decisions.find(
      (item) => item.id === decisionId,
    );
    const resolved = decision
      ? makeActivity("decision-resolved", `Answered: ${decision.question}`, {
          from: decision.from,
          artifactId: decision.artifactId,
          decisionId,
        })
      : undefined;
    setSession((current) => ({
      ...current,
      decisions: current.decisions.map((item) =>
        item.id === decisionId ? { ...item, resolved: true } : item,
      ),
      activity: resolved
        ? [...(current.activity ?? []), resolved]
        : current.activity,
    }));
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      orchestratorPending,
      researchPending,
      orchestratorReviewing: reviewPending,
      planPending,
      sendToOrchestrator,
      sendToArtifactAgent,
      artifactPending,
      raiseDecision,
      resolveDecision,
    }),
    [
      session,
      orchestratorPending,
      researchPending,
      reviewPending,
      planPending,
      sendToOrchestrator,
      sendToArtifactAgent,
      artifactPending,
      raiseDecision,
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
