import { Agent } from "@mastra/core/agent";
import { z } from "zod";

import { orchestratorModel } from "./models.ts";

/**
 * The plan synthesizer is the last stage of scoping. Where every other agent
 * owns one surface, this one reads them all: once the developer is done shaping
 * the domain model, the architecture, and the UX, it takes their diffs together
 * and writes the implementation plan that realizes them. The orchestrator hands
 * it the goal and the artifacts; it hands back prose a coding agent can act on.
 */

/** A node or edge change marker, matching the frontend's diff vocabulary. */
type Change = "added" | "removed" | "modified" | "unchanged";

interface GraphNodeInput {
  id: string;
  label: string;
  group?: string;
  change?: Change;
}

interface GraphEdgeInput {
  from: string;
  to: string;
  label?: string;
  change?: Change;
}

interface GraphBodyInput {
  type: "graph";
  nodes: GraphNodeInput[];
  edges: GraphEdgeInput[];
}

interface WireframeNodeInput {
  id: string;
  label: string;
  kind: string;
  change?: Change;
}

interface WireframeBodyInput {
  type: "wireframe";
  screen: string;
  nodes: WireframeNodeInput[];
}

interface UiNodeInput {
  id: string;
  component: string;
  props?: Record<string, string>;
  children?: UiNodeInput[];
  change?: Change;
}

interface DesignSceneInput {
  screen: string;
  root: UiNodeInput;
}

interface TokenDeltaInput {
  name: string;
  before: string;
  after: string;
}

interface DesignBodyInput {
  type: "design";
  before: DesignSceneInput;
  after: DesignSceneInput;
  tokens?: TokenDeltaInput[];
}

type ArtifactBodyInput =
  | GraphBodyInput
  | WireframeBodyInput
  | DesignBodyInput;

/** One artifact as the synthesizer reads it — trimmed to what the plan needs. */
export interface PlanArtifactInput {
  kind: "architecture" | "domain" | "ux";
  title: string;
  summary: string;
  body: ArtifactBodyInput;
}

const KIND_LABELS: Record<PlanArtifactInput["kind"], string> = {
  architecture: "Architecture",
  domain: "Domain Model",
  ux: "User Experience",
};

/** Group a list by its change marker, treating a missing marker as unchanged. */
function byChange<T extends { change?: Change }>(
  items: T[],
  change: Change,
): T[] {
  return items.filter((item) => (item.change ?? "unchanged") === change);
}

/** Render a graph artifact's diff as a few readable lines, grouped by change. */
function describeGraph(body: GraphBodyInput): string {
  const labelOf = (id: string) =>
    body.nodes.find((node) => node.id === id)?.label ?? id;
  const sections: string[] = [];

  const nodeGroups: [Change, string][] = [
    ["added", "Entities added"],
    ["modified", "Entities changed"],
    ["removed", "Entities removed"],
    ["unchanged", "Entities already there"],
  ];
  for (const [change, title] of nodeGroups) {
    const nodes = byChange(body.nodes, change);
    if (nodes.length === 0) continue;
    sections.push(`${title}: ${nodes.map((node) => node.label).join(", ")}.`);
  }

  const edgeGroups: [Change, string][] = [
    ["added", "Relationships added"],
    ["modified", "Relationships changed"],
    ["removed", "Relationships removed"],
  ];
  for (const [change, title] of edgeGroups) {
    const edges = byChange(body.edges, change);
    if (edges.length === 0) continue;
    const rendered = edges
      .map(
        (edge) =>
          `${labelOf(edge.from)} ${edge.label ?? "→"} ${labelOf(edge.to)}`,
      )
      .join("; ");
    sections.push(`${title}: ${rendered}.`);
  }

  return sections.join("\n");
}

/** Render a wireframe artifact's diff as a few readable lines, grouped by change. */
function describeWireframe(body: WireframeBodyInput): string {
  const sections: string[] = [`Screen: ${body.screen}.`];
  const groups: [Change, string][] = [
    ["added", "Elements added"],
    ["modified", "Elements changed"],
    ["removed", "Elements removed"],
  ];
  for (const [change, title] of groups) {
    const nodes = byChange(body.nodes, change);
    if (nodes.length === 0) continue;
    sections.push(
      `${title}: ${nodes.map((node) => `${node.label} (${node.kind})`).join(", ")}.`,
    );
  }
  return sections.join("\n");
}

/** Flatten a design scene's node tree into one depth-first list. */
function flattenScene(root: UiNodeInput): UiNodeInput[] {
  const out: UiNodeInput[] = [];
  const visit = (node: UiNodeInput) => {
    out.push(node);
    for (const child of node.children ?? []) visit(child);
  };
  visit(root);
  return out;
}

/** A short label for a design node: its text prop where it has one, else its component. */
function nodeLabel(node: UiNodeInput): string {
  const text = node.props?.label ?? node.props?.text ?? node.props?.placeholder;
  return text ? `${text} (${node.component})` : node.component;
}

/** Render a design artifact's diff: the screen, token swaps, and changed components. */
function describeDesign(body: DesignBodyInput): string {
  const sections: string[] = [`Screen: ${body.after.screen}.`];

  if (body.tokens && body.tokens.length > 0) {
    const swaps = body.tokens
      .map((token) => `${token.name} ${token.before} → ${token.after}`)
      .join(", ");
    sections.push(`Tokens: ${swaps}.`);
  }

  // Added and modified components live in the proposed scene; removed ones only
  // survive in the current one, so each group is read from the scene that has it.
  const proposed = flattenScene(body.after.root);
  const groups: [Change, string][] = [
    ["added", "Components added"],
    ["modified", "Components changed"],
  ];
  for (const [change, title] of groups) {
    const nodes = byChange(proposed, change);
    if (nodes.length === 0) continue;
    sections.push(`${title}: ${nodes.map(nodeLabel).join(", ")}.`);
  }

  const removed = byChange(flattenScene(body.before.root), "removed");
  if (removed.length > 0) {
    sections.push(`Components removed: ${removed.map(nodeLabel).join(", ")}.`);
  }

  return sections.join("\n");
}

/** Render one artifact body to readable diff lines, dispatching on its type. */
function describeBody(body: ArtifactBodyInput): string {
  switch (body.type) {
    case "graph":
      return describeGraph(body);
    case "wireframe":
      return describeWireframe(body);
    case "design":
      return describeDesign(body);
  }
}

/** Turn one artifact into a labeled diff block for the synthesizer's prompt. */
function describeArtifact(artifact: PlanArtifactInput): string {
  const header = `## ${KIND_LABELS[artifact.kind]}: ${artifact.title}\n${artifact.summary}`;
  return `${header}\n${describeBody(artifact.body)}`;
}

const INSTRUCTIONS = `
You are the plan synthesizer in a tool that scopes agentic coding work. By the
time you run, the developer has shaped the change across a few artifacts — a
domain model, an architecture graph, a UX wireframe — each expressed as a diff
against the current codebase. Your job is to read those diffs together and write
the implementation plan that realizes them.

Write for the engineer or coding agent who will do the work. The overview is two
or three sentences: what is being built and why, grounded in the stated goal.
Then give an ordered list of concrete implementation steps. Each step has a short
imperative title (e.g. "Add the ExportJob aggregate") and a detail of a sentence
or two saying what to do and which surface it comes from.

Sequence the steps the way you would actually build it: schema and domain
entities before the code that uses them, backend before the UI that calls it.
Ground every step in the diffs you were given — don't invent scope the artifacts
don't show. Where the surfaces connect (a new entity that needs a screen, an
architecture edge that implies an API), say so. Keep it tight: a plan to act on,
not an essay.
`.trim();

/** The agent that folds the artifact diffs into one implementation plan. */
export const planSynthesizer = new Agent({
  id: "planSynthesizer",
  name: "Plan Synthesizer",
  instructions: INSTRUCTIONS,
  model: orchestratorModel(),
});

/** The structured plan the synthesizer returns; mirrors the core `Plan` type. */
export const PlanSchema = z.object({
  overview: z
    .string()
    .describe("Two or three sentences on what is being built and why"),
  steps: z
    .array(
      z.object({
        title: z.string().describe("A short imperative title for the step"),
        detail: z
          .string()
          .describe("What to do and which artifact it comes from"),
      }),
    )
    .min(1)
    .describe("The implementation steps, in build order"),
});

export type PlanOutput = z.infer<typeof PlanSchema>;

/**
 * Read every artifact's diff together and synthesize the implementation plan.
 * The artifacts are rendered to compact, labeled diff blocks rather than raw
 * JSON so the model spends its attention on the change, not the wire format.
 */
export async function synthesizePlan(
  goal: string,
  artifacts: PlanArtifactInput[],
): Promise<PlanOutput> {
  const surfaces = artifacts.map(describeArtifact).join("\n\n");
  const content =
    `The developer's goal:\n${goal}\n\n` +
    `The artifacts they scoped, as diffs against today's codebase:\n\n${surfaces}`;
  const result = await planSynthesizer.generate([{ role: "user", content }], {
    structuredOutput: { schema: PlanSchema },
  });
  return result.object;
}
