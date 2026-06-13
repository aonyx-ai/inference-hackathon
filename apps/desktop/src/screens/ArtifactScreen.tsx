import { useNavigate, useParams } from "react-router-dom";
import { artifactKindLabel, findArtifact } from "@inference-hackathon/core";
import { ConversationThread } from "../components/ConversationThread";
import { ArtifactBody } from "../components/artifact/ArtifactBody";
import { DriftBanner } from "../components/DriftBanner";
import { QuestionBanner } from "../components/QuestionBanner";
import { StatusPill } from "../components/StatusPill";
import { useSession } from "../state/SessionContext";

/**
 * The artifact agent screen: a full screen showing one artifact's body on the
 * canvas with a docked thread to that artifact's agent. Navigating here from
 * the orchestration screen is a plain screen change; the back link returns.
 */
export function ArtifactScreen() {
  const { artifactId } = useParams();
  const navigate = useNavigate();
  const { session, sendToArtifactAgent, artifactPending } = useSession();
  const artifact = artifactId ? findArtifact(session, artifactId) : undefined;

  const back = () => navigate("/");

  if (!artifact) {
    return (
      <div className="artifact-screen">
        <header className="artifact__bar">
          <button className="back" onClick={back}>
            ← Orchestration
          </button>
        </header>
        <p className="artifact__missing">That artifact no longer exists.</p>
      </div>
    );
  }

  return (
    <div className={`artifact-screen artifact-screen--${artifact.kind}`}>
      <header className="artifact__bar">
        <button className="back" onClick={back}>
          ← Orchestration
        </button>
        <div className="artifact__heading">
          <span className="artifact__kind">
            {artifactKindLabel(artifact.kind)}
          </span>
          <h1 className="artifact__title">{artifact.title}</h1>
        </div>
        <StatusPill status={artifact.status} />
      </header>
      {artifact.staleReason ? (
        <DriftBanner reason={artifact.staleReason} />
      ) : null}
      {artifact.openQuestion ? (
        <QuestionBanner question={artifact.openQuestion} />
      ) : null}
      <div className="artifact__main">
        <div className="artifact__canvas">
          <ArtifactBody body={artifact.body} />
        </div>
        <aside className="artifact__chat">
          <ConversationThread
            title={`${artifactKindLabel(artifact.kind)} agent`}
            messages={artifact.conversation}
            placeholder="Ask this agent…"
            onSend={(text) => sendToArtifactAgent(artifact.id, text)}
            pending={artifactPending(artifact.id)}
          />
        </aside>
      </div>
    </div>
  );
}
