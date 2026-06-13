import type { WireframeBody } from "@inference-hackathon/core";

const COLUMNS = 12;

/** A low-fidelity wireframe rendered on a 12-column grid, diff-colored. */
export function WireframeArtifact({
  body,
  preview = false,
}: {
  body: WireframeBody;
  preview?: boolean;
}) {
  const rows = Math.max(...body.nodes.map((node) => node.row + node.height));

  return (
    <div className={`wireframe ${preview ? "wireframe--preview" : ""}`}>
      <div
        className="wireframe__canvas"
        style={{
          gridTemplateColumns: `repeat(${COLUMNS}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
        }}
      >
        {body.nodes.map((node) => (
          <div
            key={node.id}
            className={`wireframe__node wireframe__node--${node.kind} wireframe__node--${node.change ?? "unchanged"}`}
            style={{
              gridColumn: `${node.col + 1} / span ${node.width}`,
              gridRow: `${node.row + 1} / span ${node.height}`,
            }}
          >
            <span className="wireframe__label">{node.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
