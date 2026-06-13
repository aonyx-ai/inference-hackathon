/**
 * Parse a Mermaid `classDiagram` into the deck's graph shape. It reads the
 * subset our own `toMermaid` emits — classes (optionally grouped by namespace)
 * and the relationships between them — and drops the detail a graph doesn't
 * carry (fields, stereotypes, notes). This is how an artifact stored on disk as
 * Mermaid becomes the editable graph the domain agent works on.
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
