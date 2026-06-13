import type { Session } from "@inference-hackathon/core";

/**
 * A seed session with one domain-model artifact, so the artifact agent screen
 * can be exercised before the orchestrator is wired up to spawn artifacts on its
 * own. The graph starts as the model "as it stands today" — every node and edge
 * marked `unchanged` — so anything the domain agent adds, removes, or modifies
 * shows up colored against this baseline in the differ.
 *
 * `main.tsx` seeds this; tests and the empty app start from a blank session.
 * Delete the seed once the orchestrator produces artifacts for real.
 */
export const mockSession: Session = {
  id: "mock-session",
  goal: "Add team collaboration to projects",
  conversation: [
    {
      id: "mock-m1",
      author: "orchestrator",
      text: 'I\'ve sketched the current domain model from the codebase. Open the Domain Model artifact below and tell its agent what to change — e.g. "let tasks have comments".',
      at: "2026-06-13T10:00:00Z",
    },
  ],
  decisions: [],
  artifacts: [
    {
      id: "mock-domain",
      kind: "domain",
      title: "Projects and tasks",
      summary:
        "The entities behind projects and tasks today. Refine the model with its agent.",
      status: "drafting",
      conversation: [
        {
          id: "mock-dc1",
          author: "domain",
          text: 'Here\'s the domain as it stands today. Tell me what to add or change and I\'ll update the model — for example, "add a Comment entity on tasks" or "let a project have many members".',
          at: "2026-06-13T10:00:05Z",
        },
      ],
      body: {
        type: "graph",
        nodes: [
          { id: "user", label: "User", change: "unchanged" },
          { id: "project", label: "Project", change: "unchanged" },
          { id: "task", label: "Task", change: "unchanged" },
        ],
        edges: [
          { from: "user", to: "project", label: "owns", change: "unchanged" },
          {
            from: "project",
            to: "task",
            label: "contains",
            change: "unchanged",
          },
          { from: "user", to: "task", label: "assigned", change: "unchanged" },
        ],
      },
    },
  ],
};
