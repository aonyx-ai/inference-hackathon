import { useNavigate } from "react-router-dom";
import { artifactKindLabel, openDecisions } from "@inference-hackathon/core";
import { Composer } from "../components/Composer";
import { Message } from "../components/Message";
import { ArtifactCard } from "../components/ArtifactCard";
import { useSession } from "../state/SessionContext";

/**
 * Home base, top to bottom: the task, the chat and activity history with the
 * orchestrator (where agents' questions surface as clickable activity), and
 * the artifacts the orchestrator produced. Clicking a question or an artifact
 * opens that artifact's screen.
 */
export function OrchestrationScreen() {
  const {
    session,
    orchestratorPending,
    researchPending,
    architecturePending,
    sendToOrchestrator,
  } = useSession();
  const navigate = useNavigate();
  const open = openDecisions(session);
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
            {session.conversation.map((message) => (
              <Message key={message.id} message={message} />
            ))}
            {open.map((decision) => (
              <li key={decision.id}>
                <button
                  className="activity-item"
                  onClick={() => navigate(`/artifact/${decision.artifactId}`)}
                >
                  <span className="activity-item__label">
                    {artifactKindLabel(decision.from)} agent needs input
                  </span>
                  <span className="activity-item__text">
                    {decision.question}
                  </span>
                </button>
              </li>
            ))}
          </ol>
          {researchPending && (
            <p className="activity__pending">
              Researching the repository with Nemotron…
            </p>
          )}
          {orchestratorPending && (
            <p className="activity__pending">Orchestrator is thinking…</p>
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

        {(session.artifacts.length > 0 || architecturePending) && (
          <section className="artifacts">
            <h2 className="artifacts__title">Artifacts</h2>
            <div className="artifacts__list">
              {session.artifacts.map((artifact) => (
                <ArtifactCard key={artifact.id} artifact={artifact} />
              ))}
              {architecturePending && (
                <div className="card card--pending">
                  <span className="card__kind">Architecture</span>
                  <p className="card__summary">
                    {researchPending
                      ? "Reading the repository…"
                      : "Mapping the architecture…"}
                  </p>
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
