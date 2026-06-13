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
  const { session, sendToOrchestrator } = useSession();
  const navigate = useNavigate();
  const open = openDecisions(session);

  return (
    <div className="orchestration">
      <div className="orchestration__column">
        <header className="task">
          <span className="task__eyebrow">Task</span>
          <h1 className="task__goal">{session.goal}</h1>
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
          <Composer
            placeholder="Reply to the orchestrator…"
            onSend={sendToOrchestrator}
          />
        </section>

        <section className="artifacts">
          <h2 className="artifacts__title">Artifacts</h2>
          <div className="artifacts__list">
            {session.artifacts.map((artifact) => (
              <ArtifactCard key={artifact.id} artifact={artifact} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
