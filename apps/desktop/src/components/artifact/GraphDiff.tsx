import type { GraphBody } from "@inference-hackathon/core";

interface Point {
  x: number;
  y: number;
}

/** How far a single-group graph's circle reaches into the 0–100 viewBox. */
const RADIUS = 34;

/**
 * Place every node in the 0–100 viewBox. Graphs whose nodes carry layer groups
 * — e.g. an architecture diagram's client/api/infra — lay out in a column per
 * group. A graph with a single group (a domain model, where the relationships
 * are the whole point) would otherwise collapse into one vertical column with
 * its edges stacked on top of each other, so those nodes go around a circle
 * instead: every node lands at a distinct spot and edges become readable chords.
 *
 * Exported so the layout can be asserted directly in tests, independent of the
 * SVG rendering.
 */
export function layoutGraph(body: GraphBody): Map<string, Point> {
  const positions = new Map<string, Point>();
  const groups = [
    ...new Set(body.nodes.map((node) => node.group ?? "default")),
  ];

  if (groups.length <= 1) {
    const count = body.nodes.length;
    body.nodes.forEach((node, index) => {
      if (count === 1) {
        positions.set(node.id, { x: 50, y: 50 });
        return;
      }
      // Walk the circle from the top, clockwise. Indexing by position keeps the
      // layout stable as the agent adds nodes, and no two nodes ever coincide.
      const angle = (2 * Math.PI * index) / count - Math.PI / 2;
      positions.set(node.id, {
        x: 50 + RADIUS * Math.cos(angle),
        y: 50 + RADIUS * Math.sin(angle),
      });
    });
    return positions;
  }

  const columnWidth = 100 / groups.length;
  groups.forEach((group, columnIndex) => {
    const inColumn = body.nodes.filter(
      (node) => (node.group ?? "default") === group,
    );
    inColumn.forEach((node, rowIndex) => {
      positions.set(node.id, {
        x: columnWidth * (columnIndex + 0.5),
        y: (100 / (inColumn.length + 1)) * (rowIndex + 1),
      });
    });
  });
  return positions;
}

/**
 * A deliberately simple diffable graph: nodes positioned by {@link layoutGraph},
 * edges drawn as SVG lines, both colored by their change type. Good enough to
 * read a plan at a glance; a richer layout (e.g. React Flow) can slot in behind
 * the same props later.
 */
export function GraphDiff({
  body,
  preview = false,
}: {
  body: GraphBody;
  preview?: boolean;
}) {
  const positions = layoutGraph(body);

  return (
    <div className={`graph ${preview ? "graph--preview" : ""}`}>
      <svg
        className="graph__edges"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {body.edges.map((edge) => {
          const from = positions.get(edge.from);
          const to = positions.get(edge.to);
          if (!from || !to) return null;
          return (
            <line
              key={`${edge.from}-${edge.to}`}
              className={`graph__edge graph__edge--${edge.change ?? "unchanged"}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
            />
          );
        })}
      </svg>
      {body.nodes.map((node) => {
        const position = positions.get(node.id);
        if (!position) return null;
        return (
          <div
            key={node.id}
            className={`graph__node graph__node--${node.change ?? "unchanged"}`}
            style={{ left: `${position.x}%`, top: `${position.y}%` }}
          >
            {node.label}
          </div>
        );
      })}
    </div>
  );
}
