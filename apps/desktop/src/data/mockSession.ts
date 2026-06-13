import type { Session } from "@inference-hackathon/core";
import type { DomainModel } from "@inference-hackathon/domain";

/**
 * The model "as it stands today" for the seed session: a small Projects and
 * Tasks domain. It is its own baseline, so anything the domain agent adds,
 * removes, or modifies shows up colored against it once the model is overlaid.
 */
const projectsAndTasks: DomainModel = {
  contexts: [{ id: "collaboration", name: "Collaboration" }],
  entities: [
    {
      id: "user",
      name: "User",
      kind: "AggregateRoot",
      context: "collaboration",
      fields: [
        {
          id: "user.id",
          name: "id",
          type: { kind: "Scalar", name: "UserId" },
          role: "Identity",
        },
        {
          id: "user.name",
          name: "name",
          type: { kind: "Scalar", name: "string" },
        },
        {
          id: "user.email",
          name: "email",
          type: { kind: "Scalar", name: "string" },
        },
      ],
    },
    {
      id: "project",
      name: "Project",
      kind: "AggregateRoot",
      context: "collaboration",
      fields: [
        {
          id: "project.id",
          name: "id",
          type: { kind: "Scalar", name: "ProjectId" },
          role: "Identity",
        },
        {
          id: "project.name",
          name: "name",
          type: { kind: "Scalar", name: "string" },
        },
        {
          id: "project.owner",
          name: "owner",
          type: { kind: "Reference", target: "user" },
        },
        {
          id: "project.tasks",
          name: "tasks",
          type: { kind: "Contains", target: "task" },
          collection: true,
        },
      ],
    },
    {
      id: "task",
      name: "Task",
      kind: "Entity",
      context: "collaboration",
      fields: [
        {
          id: "task.id",
          name: "id",
          type: { kind: "Scalar", name: "TaskId" },
          role: "Identity",
        },
        {
          id: "task.title",
          name: "title",
          type: { kind: "Scalar", name: "string" },
        },
        {
          id: "task.done",
          name: "done",
          type: { kind: "Scalar", name: "boolean" },
        },
        {
          id: "task.assignee",
          name: "assignee",
          type: { kind: "Reference", target: "user" },
          optional: true,
        },
      ],
    },
  ],
};

/**
 * A seed session with one domain-model artifact, so the artifact agent screen
 * can be exercised before the orchestrator is wired up to spawn artifacts on its
 * own.
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
        type: "domain",
        baseline: projectsAndTasks,
        model: projectsAndTasks,
      },
    },
  ],
};
