import { useNavigate } from "react-router-dom";
import type { Artifact } from "@inference-hackathon/core";
import { artifactKindLabel } from "@inference-hackathon/core";
import { StatusPill } from "./StatusPill";
import { ArtifactBody } from "./artifact/ArtifactBody";

/**
 * A tile in the orchestration deck. Its mini-preview is the same renderer as
 * the full view, so the card genuinely previews the artifact. Clicking it
 * zooms into the artifact agent screen.
 */
export function ArtifactCard({ artifact }: { artifact: Artifact }) {
  const navigate = useNavigate();

  return (
    <button
      className={`card card--${artifact.kind}`}
      onClick={() => navigate(`/artifact/${artifact.id}`)}
    >
      <header className="card__header">
        <span className="card__kind">{artifactKindLabel(artifact.kind)}</span>
        <StatusPill status={artifact.status} />
      </header>
      <h3 className="card__title">{artifact.title}</h3>
      <div className="card__preview">
        <ArtifactBody body={artifact.body} preview />
      </div>
      <p className="card__summary">{artifact.summary}</p>
    </button>
  );
}
