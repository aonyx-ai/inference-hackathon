import type { GraphBody } from "@inference-hackathon/core";

/**
 * A deliberately simple diffable graph: nodes laid out in columns by their
 * group, edges drawn as SVG lines, both colored by their change type. Good
 * enough to read a plan at a glance; a richer layout (e.g. React Flow) can
 * slot in behind the same props later.
 */
export function GraphDiff({
  body,
  preview = false,
}: {
  body: GraphBody;
  preview?: boolean;
}) {
  const groups = [
    ...new Set(body.nodes.map((node) => node.group ?? "default")),
  ];
  const columnWidth = 100 / groups.length;

  const positions = new Map<string, { x: number; y: number }>();
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
