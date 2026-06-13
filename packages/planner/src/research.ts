import { Agent } from "@mastra/core/agent";
import { z } from "zod";

import { researchModel } from "./models.ts";
import { repoTools } from "./research-tools.ts";

/**
 * The repo-research stage. Once the developer has said which change they want,
 * a group of Nemotron-powered agents reads the actual working directory to work
 * out how the repository functions today, and distills that into the context
 * the artifact-modification agents need. Each artifact surface — architecture,
 * the domain model, and the user experience — has its own researcher so each
 * one explores the code through the lens of the artifact it feeds, and the
 * three run in parallel against the same checkout.
 *
 * The researchers only read: they map the project, search for the concepts the
 * change touches, and read the files that matter. They do not propose changes —
 * that is the artifact agents' job. Their output is grounding, not a plan.
 */

/** The three surfaces the planner reasons about; see the README. */
export const SURFACES = ["architecture", "domain", "ux"] as const;
export type Surface = (typeof SURFACES)[number];

/**
 * What one researcher reports back about its surface. This is the context an
 * artifact agent consumes: how the relevant part of the repo works today, the
 * concrete places the change will land, the conventions to honor, and the
 * questions exploration could not settle.
 */
export const SurfaceFindingsSchema = z.object({
  summary: z
    .string()
    .describe(
      "How the part of the repository relevant to this surface works today, " +
        "grounded in files you actually read",
    ),
  relevantPaths: z
    .array(
      z.object({
        path: z.string().describe("A file or directory path, repo-relative"),
        why: z
          .string()
          .describe("Why this path matters for the requested change"),
      }),
    )
    .describe("The handful of paths the artifact agent should anchor on"),
  touchpoints: z
    .array(z.string())
    .describe(
      "Specific modules, types, or functions the change is likely to touch",
    ),
  conventions: z
    .array(z.string())
    .describe(
      "Patterns the change must follow to fit the codebase, e.g. how errors " +
        "are handled or how modules are wired",
    ),
  openQuestions: z
    .array(z.string())
    .describe("Things exploration could not resolve that the plan must settle"),
});

export type SurfaceFindings = z.infer<typeof SurfaceFindingsSchema>;

/** The assembled grounding handed to the artifact agents. */
export interface RepoContext {
  goal: string;
  root: string;
  surfaces: Record<Surface, SurfaceFindings>;
}

/** Per-surface framing: what this researcher is looking for and why. */
const SURFACE_FOCUS: Record<Surface, string> = {
  architecture:
    "the services, packages, modules, and data flow the change touches: how " +
    "the codebase is structured, where boundaries and dependencies lie, and " +
    "which components a change would have to cross or respect",
  domain:
    "the domain model the change touches: the entities, aggregates, and value " +
    "objects already in the code, the relationships between them, and the " +
    "names developers use for them",
  ux:
    "the user experience the change touches: the screens, components, routes, " +
    "and interactions already present, and where a new flow would slot in",
};

function instructionsFor(surface: Surface): string {
  return `
You are the ${surface} researcher in a tool that scopes coding work before any
code is written. You are not writing the plan; you are building the context the
${surface} planning agent will rely on.

You have read-only tools over a real repository: list_files to map it, read_file
to read a file, and search_repo to find where a concept lives. Use them. Never
guess how the code works — open the files and confirm. Start by mapping the
project from the root, search for the terms in the requested change, then read
the files those searches surface.

Focus on ${SURFACE_FOCUS[surface]}.

Be concrete and specific to this repository: cite real paths, real type and
function names, and real conventions you observed. Prefer a few high-signal
findings over an exhaustive dump. When you have explored enough to ground the
${surface} plan, report your findings in the required structure.
`.trim();
}

/** Build the researcher for one surface, bound to the repo at `root`. */
function researcherFor(surface: Surface, root: string): Agent {
  return new Agent({
    id: `${surface}Researcher`,
    name: `${surface} researcher`,
    instructions: instructionsFor(surface),
    model: researchModel(),
    tools: repoTools(root),
  });
}

/** How many tool-call rounds a researcher gets before it must report. */
const MAX_RESEARCH_STEPS = 16;

async function research(
  surface: Surface,
  goal: string,
  root: string,
): Promise<SurfaceFindings> {
  const agent = researcherFor(surface, root);
  const result = await agent.generate(
    [
      {
        role: "user",
        content: `The developer wants to make this change:\n\n${goal}\n\nExplore the repository and report the ${surface} context for it.`,
      },
    ],
    {
      maxSteps: MAX_RESEARCH_STEPS,
      structuredOutput: { schema: SurfaceFindingsSchema },
    },
  );
  return result.object;
}

/**
 * Run the research fan-out: every surface researcher explores the repo at `root`
 * in parallel and the findings are collected into a single {@link RepoContext}.
 * If a researcher fails, its surface is filled with an empty finding noting the
 * failure rather than sinking the whole stage — a missing surface should not
 * stop the others from grounding their artifacts.
 */
export async function researchRepo(
  goal: string,
  root: string,
): Promise<RepoContext> {
  const findings = await Promise.all(
    SURFACES.map(async (surface) => {
      try {
        return [surface, await research(surface, goal, root)] as const;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        return [
          surface,
          {
            summary: `Research failed: ${message}`,
            relevantPaths: [],
            touchpoints: [],
            conventions: [],
            openQuestions: [
              `The ${surface} surface was not researched because exploration failed.`,
            ],
          } satisfies SurfaceFindings,
        ] as const;
      }
    }),
  );

  return {
    goal,
    root,
    surfaces: Object.fromEntries(findings) as Record<Surface, SurfaceFindings>,
  };
}

/**
 * Render one surface's findings as a prompt block for the matching artifact
 * agent, so the grounding the researcher gathered travels into the agent that
 * proposes the change.
 */
export function formatSurfaceContext(
  context: RepoContext,
  surface: Surface,
): string {
  const findings = context.surfaces[surface];
  const paths = findings.relevantPaths
    .map((entry) => `  - ${entry.path}: ${entry.why}`)
    .join("\n");
  const lines = [
    `Repository context for the ${surface} surface (gathered by reading the actual code):`,
    "",
    `How it works today: ${findings.summary}`,
  ];
  if (findings.relevantPaths.length > 0) {
    lines.push("", "Relevant paths:", paths);
  }
  if (findings.touchpoints.length > 0) {
    lines.push("", `Likely touchpoints: ${findings.touchpoints.join("; ")}`);
  }
  if (findings.conventions.length > 0) {
    lines.push("", `Conventions to honor: ${findings.conventions.join("; ")}`);
  }
  if (findings.openQuestions.length > 0) {
    lines.push("", `Open questions: ${findings.openQuestions.join("; ")}`);
  }
  return lines.join("\n");
}
