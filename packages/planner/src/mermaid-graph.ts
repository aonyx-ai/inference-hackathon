/**
 * Parse the Mermaid our renderers emit into the deck's graph shape. A
 * `classDiagram` (the domain model) and a `flowchart` (the architecture
 * dependency graph) each become nodes and edges, dropping the detail a graph
 * doesn't carry (class fields, link styling). This is how an artifact stored on
 * disk as Mermaid becomes the editable graph an artifact agent works on.
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

const NAMESPACE = /^namespace\s+(\S+)\s*\{$/;
const CLASS = /^class\s+(\w+)\s*\{?$/;
// `From <arrow> ["card"] To [: label]`, where arrow is any class-diagram
// connector. Cardinality and the trailing label are both optional.
const EDGE =
  /^(\w+)\s+(?:"[^"]*"\s+)?(\*--|<\|--|-->|--\*|--\|>|<--|o--|--o|\.\.>|<\.\.|--)\s+(?:"[^"]*"\s+)?(\w+)\s*(?::\s*(.+?))?$/;

/** Trim Mermaid's `Context` namespace suffix back to the bounded-context name. */
function groupName(namespace: string): string {
  return namespace.replace(/Context$/, "");
}

export function parseMermaidClassDiagram(diagram: string): ParsedGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();

  let group: string | undefined;
  let inClassBody = false;

  for (const raw of diagram.split("\n")) {
    const line = raw.trim();
    if (line === "") continue;

    const namespace = NAMESPACE.exec(line);
    if (namespace) {
      group = groupName(namespace[1]!);
      continue;
    }

    const klass = CLASS.exec(line);
    if (klass) {
      const name = klass[1]!;
      if (!seen.has(name)) {
        seen.add(name);
        nodes.push(
          group ? { id: name, label: name, group } : { id: name, label: name },
        );
      }
      inClassBody = !line.endsWith("}");
      continue;
    }

    // A `}` closes the open class body, or — once classes are done — the
    // namespace. Everything inside a class body is a field we ignore.
    if (line === "}") {
      if (inClassBody) inClassBody = false;
      else group = undefined;
      continue;
    }
    if (inClassBody) continue;

    const edge = EDGE.exec(line);
    if (edge) {
      const [, from, , to, label] = edge;
      edges.push(
        label ? { from: from!, to: to!, label } : { from: from!, to: to! },
      );
    }
  }

  return { nodes, edges };
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

/** Parse whichever Mermaid graph an artifact file holds, by its first directive. */
export function parseMermaidGraph(diagram: string): ParsedGraph {
  return /^\s*flowchart\b/m.test(diagram)
    ? parseMermaidFlowchart(diagram)
    : parseMermaidClassDiagram(diagram);
}
