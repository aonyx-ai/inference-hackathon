import { useNavigate } from "react-router-dom";
import { activityFeed, artifactKindLabel } from "@inference-hackathon/core";
import { Composer } from "../components/Composer";
import { Message } from "../components/Message";
import { ActivityItem } from "../components/ActivityItem";
import { ArtifactCard } from "../components/ArtifactCard";
import { PlanView } from "../components/PlanView";
import { useSession } from "../state/SessionContext";

/**
 * Home base, top to bottom: the task, the chat and activity history with the
 * orchestrator (where agents' background work and questions surface as feed
 * entries), and the artifacts the orchestrator produced. Clicking a question or
 * an artifact opens that artifact's screen. When the orchestrator reads that
 * scoping is done, the synthesized plan lands at the bottom.
 */
export function OrchestrationScreen() {
  const {
    session,
    orchestratorPending,
    orchestratorReviewing,
    planPending,
    sendToOrchestrator,
  } = useSession();
  const navigate = useNavigate();
  const feed = activityFeed(session);
  const resolved = new Set(
    session.decisions.filter((decision) => decision.resolved).map((d) => d.id),
  );
  // Artifacts whose agent bubbled a question up to the orchestrator: each is a
  // nudge to open that artifact and answer in its thread.
  const needsInput = session.artifacts.filter(
    (artifact) => artifact.openQuestion,
  );
  const started = session.conversation.length > 0;

  return (
    <div className="orchestration">
      <div className="orchestration__column">
        <header className="task">
          <span className="task__eyebrow">Task</span>
          {session.goal ? (
            <h1 className="task__goal">{session.goal}</h1>
          ) : (
            <h1 className="task__goal task__goal--empty">
              Describe the change you want to scope
            </h1>
          )}
        </header>

        <section className="activity">
          <ol className="activity__feed">
            {feed.map((item) =>
              item.type === "message" ? (
                <Message key={item.message.id} message={item.message} />
              ) : (
                <li key={item.activity.id}>
                  <ActivityItem
                    event={item.activity}
                    resolved={
                      item.activity.decisionId
                        ? resolved.has(item.activity.decisionId)
                        : false
                    }
                    onOpen={(id) => navigate(`/artifact/${id}`)}
                  />
                </li>
              ),
            )}
            {needsInput.map((artifact) => (
              <li key={`needs-input-${artifact.id}`}>
                <button
                  className="activity-item"
                  onClick={() => navigate(`/artifact/${artifact.id}`)}
                >
                  <span className="activity-item__label">
                    {artifactKindLabel(artifact.kind)} agent needs your input
                  </span>
                  <span className="activity-item__text">
                    {artifact.openQuestion}
                  </span>
                </button>
              </li>
            ))}
          </ol>
          {orchestratorPending && (
            <p className="activity__pending">Orchestrator is thinking…</p>
          )}
          {orchestratorReviewing && (
            <p className="activity__pending">
              Orchestrator is reviewing the change across surfaces…
            </p>
          )}
          <Composer
            placeholder={
              started
                ? "Reply to the orchestrator…"
                : "Describe the task you want to scope…"
            }
            onSend={sendToOrchestrator}
            disabled={orchestratorPending}
          />
        </section>

        {session.artifacts.length > 0 && (
          <section className="artifacts">
            <h2 className="artifacts__title">Artifacts</h2>
            <div className="artifacts__list">
              {session.artifacts.map((artifact) => (
                <ArtifactCard key={artifact.id} artifact={artifact} />
              ))}
            </div>
          </section>
        )}

        {(planPending || session.plan) && (
          <section className="plan">
            <h2 className="artifacts__title">Plan</h2>
            {planPending && (
              <p className="activity__pending">
                Drawing your artifacts together into a plan…
              </p>
            )}
            {session.plan && <PlanView plan={session.plan} />}
          </section>
        )}
      </div>
    </div>
  );
}
