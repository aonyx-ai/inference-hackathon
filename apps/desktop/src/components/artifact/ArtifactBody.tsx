import type { ArtifactBodyData } from "@inference-hackathon/core";
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
    case "wireframe":
      return <WireframeArtifact body={body} preview={preview} />;
  }
}
