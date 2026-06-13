/**
 * Parse the Mermaid `flowchart` our architecture renderer emits into the deck's
 * graph shape — nodes and edges, dropping the link styling a graph doesn't
 * carry. This is how the architecture artifact stored on disk as Mermaid becomes
 * the editable graph its agent works on. (The domain model is kept on disk as a
 * structured model and rendered with Mermaid directly, so it needs no parsing.)
 */

export interface GraphNode {
  id: string;
  label: string;
  group?: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  label?: string;
}

export interface ParsedGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// A flowchart node, e.g. `n0["core"]` (internal) or `n4(["react"])` (external).
const FLOW_NODE = /^(\w+)(\(\[|\[)"([^"]+)"(?:\]\)|\])$/;
// A flowchart edge, e.g. `n2 --> n4` or `n2 -->|uses| n4`.
const FLOW_EDGE = /^(\w+)\s*-->\s*(?:\|([^|]*)\|\s*)?(\w+)$/;

/**
 * Parse a Mermaid `flowchart` into the graph shape. Mermaid node ids are opaque
 * (`n0`), so we key nodes by their display label and translate the edges'
 * opaque ids to those labels — the same labels the architecture agent reasons
 * with. Node shape carries the only grouping a dependency graph has: bracketed
 * nodes are internal components, stadium nodes are external packages.
 */
export function parseMermaidFlowchart(diagram: string): ParsedGraph {
  const labelByMid = new Map<string, string>();
  const groupByMid = new Map<string, string>();
  const order: string[] = [];
  const rawEdges: { from: string; to: string; label?: string }[] = [];

  for (const raw of diagram.split("\n")) {
    const line = raw.trim();
    if (line === "" || line.startsWith("flowchart") || line === "end") continue;
    if (/^(linkStyle|classDef|class |style |subgraph)/.test(line)) continue;

    const node = FLOW_NODE.exec(line);
    if (node) {
      const [, mid, open, label] = node;
      if (!labelByMid.has(mid!)) {
        labelByMid.set(mid!, label!);
        groupByMid.set(mid!, open === "([" ? "external" : "internal");
        order.push(mid!);
      }
      continue;
    }

    const edge = FLOW_EDGE.exec(line);
    if (edge) {
      const [, from, label, to] = edge;
      rawEdges.push(
        label ? { from: from!, to: to!, label } : { from: from!, to: to! },
      );
    }
  }

  const nodes: GraphNode[] = order.map((mid) => {
    const label = labelByMid.get(mid)!;
    const group = groupByMid.get(mid);
    return group ? { id: label, label, group } : { id: label, label };
  });
  const edges: GraphEdge[] = rawEdges.map((edge) => {
    const from = labelByMid.get(edge.from) ?? edge.from;
    const to = labelByMid.get(edge.to) ?? edge.to;
    return edge.label ? { from, to, label: edge.label } : { from, to };
  });
  return { nodes, edges };
}
