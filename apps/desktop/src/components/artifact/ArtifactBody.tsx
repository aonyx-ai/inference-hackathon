import type { ArtifactBodyData } from "@inference-hackathon/core";
import { DesignArtifact } from "./DesignArtifact";
import { DomainArtifact } from "./DomainArtifact";
import { GraphDiff } from "./GraphDiff";
import { WireframeArtifact } from "./WireframeArtifact";

/** Dispatches an artifact's body to the renderer for its surface. */
export function ArtifactBody({
  body,
  preview = false,
}: {
  body: ArtifactBodyData;
  preview?: boolean;
}) {
  switch (body.type) {
    case "graph":
      return <GraphDiff body={body} preview={preview} />;
    case "domain":
      return <DomainArtifact body={body} preview={preview} />;
    case "wireframe":
      return <WireframeArtifact body={body} preview={preview} />;
    case "design":
      return <DesignArtifact body={body} preview={preview} />;
  }
}
