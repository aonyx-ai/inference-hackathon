import type { Session } from "@inference-hackathon/core";

/**
 * A worked example session used as a test fixture: a developer asks to add PDF
 * export to a dashboard, and the orchestrator has fanned the work out to the
 * three artifact agents, two of which have already raised questions. The app
 * itself starts from an empty session — this only seeds the screens under test.
 */
export const sampleSession: Session = {
  id: "session-pdf-export",
  goal: "Let users export their dashboard as a PDF",
  conversation: [
    {
      id: "m1",
      author: "user",
      text: "Add a way for users to export their dashboard as a PDF.",
      at: "2026-06-13T09:00:00Z",
    },
    {
      id: "m2",
      author: "orchestrator",
      text: "Exploring the codebase. The dashboard renders client-side from DashboardService, and there's no document-generation path today. I'll scope this across architecture, the domain model, and the UI.",
      at: "2026-06-13T09:00:12Z",
    },
    {
      id: "m3",
      author: "orchestrator",
      text: "Two agents need a decision from you before I can finalize the plan — they're below. Open one to talk it through.",
      at: "2026-06-13T09:01:40Z",
    },
  ],
  decisions: [
    {
      id: "d1",
      artifactId: "a-arch",
      from: "architecture",
      question:
        "Render PDFs synchronously in the request, or hand off to a background job queue? This decides whether we add a queue and worker.",
      resolved: false,
    },
    {
      id: "d2",
      artifactId: "a-domain",
      from: "domain",
      question:
        "Should an export be a first-class entity with history, or a fire-and-forget action that returns a file?",
      resolved: false,
    },
  ],
  artifacts: [
    {
      id: "a-arch",
      kind: "architecture",
      title: "PDF rendering pipeline",
      summary:
        "Introduces a rendering service behind the dashboard; open question on sync vs. queued.",
      status: "needs-input",
      conversation: [
        {
          id: "ac1",
          author: "architecture",
          text: "I can add an ExportController that calls a new PdfRenderingService. Whether we need a JobQueue depends on the sync-vs-async decision I raised.",
          at: "2026-06-13T09:01:20Z",
        },
      ],
      body: {
        type: "graph",
        nodes: [
          { id: "ui", label: "Dashboard UI", group: "client" },
          {
            id: "ctrl",
            label: "ExportController",
            group: "api",
            change: "added",
          },
          { id: "dash", label: "DashboardService", group: "api" },
          {
            id: "pdf",
            label: "PdfRenderingService",
            group: "api",
            change: "added",
          },
          { id: "queue", label: "JobQueue", group: "infra", change: "added" },
          {
            id: "store",
            label: "BlobStorage",
            group: "infra",
            change: "added",
          },
        ],
        edges: [
          { from: "ui", to: "ctrl", label: "POST /export", change: "added" },
          { from: "ctrl", to: "queue", label: "enqueue", change: "added" },
          { from: "queue", to: "pdf", label: "render", change: "added" },
          { from: "pdf", to: "dash", label: "read", change: "added" },
          { from: "pdf", to: "store", label: "store", change: "added" },
        ],
      },
    },
    {
      id: "a-domain",
      kind: "domain",
      title: "Export as a tracked entity",
      summary:
        "Adds an ExportJob aggregate linked to Dashboard and User; retention undecided.",
      status: "needs-input",
      conversation: [
        {
          id: "dc1",
          author: "domain",
          text: "If exports are tracked, I'd add an ExportJob entity with status and a link to the Dashboard. If fire-and-forget, none of this lands. That's the decision I raised.",
          at: "2026-06-13T09:01:25Z",
        },
      ],
      body: {
        type: "graph",
        nodes: [
          { id: "user", label: "User" },
          { id: "dashboard", label: "Dashboard" },
          { id: "job", label: "ExportJob", change: "added" },
          { id: "status", label: "ExportStatus", change: "added" },
        ],
        edges: [
          { from: "user", to: "dashboard", label: "owns" },
          { from: "user", to: "job", label: "requests", change: "added" },
          {
            from: "dashboard",
            to: "job",
            label: "exported as",
            change: "added",
          },
          { from: "job", to: "status", label: "has", change: "added" },
        ],
      },
    },
    {
      id: "a-ux",
      kind: "ux",
      title: "Export action and progress",
      summary:
        "An Export button on the dashboard header opening a format-and-progress dialog.",
      status: "stale",
      staleReason:
        "The architecture decision on synchronous vs. queued rendering may change whether this dialog shows progress or downloads instantly.",
      conversation: [
        {
          id: "uc1",
          author: "ux",
          text: "I placed an Export button in the dashboard header and a dialog for format choice plus progress. If rendering is async, the dialog shows a progress state rather than an instant download.",
          at: "2026-06-13T09:01:30Z",
        },
      ],
      body: {
        type: "wireframe",
        screen: "Dashboard",
        nodes: [
          {
            id: "header",
            label: "Dashboard header",
            kind: "container",
            col: 0,
            row: 0,
            width: 12,
            height: 2,
          },
          {
            id: "title",
            label: "My Dashboard",
            kind: "text",
            col: 0,
            row: 0,
            width: 6,
            height: 2,
          },
          {
            id: "export",
            label: "Export ▾",
            kind: "button",
            col: 10,
            row: 0,
            width: 2,
            height: 2,
            change: "added",
          },
          {
            id: "body",
            label: "Charts and widgets",
            kind: "container",
            col: 0,
            row: 2,
            width: 12,
            height: 8,
          },
          {
            id: "dialog",
            label: "Export dialog",
            kind: "container",
            col: 3,
            row: 3,
            width: 6,
            height: 5,
            change: "added",
          },
          {
            id: "format",
            label: "Format: PDF",
            kind: "input",
            col: 4,
            row: 4,
            width: 4,
            height: 1,
            change: "added",
          },
          {
            id: "progress",
            label: "Rendering… 60%",
            kind: "text",
            col: 4,
            row: 5,
            width: 4,
            height: 1,
            change: "added",
          },
          {
            id: "download",
            label: "Download",
            kind: "button",
            col: 4,
            row: 6,
            width: 4,
            height: 1,
            change: "added",
          },
        ],
      },
    },
  ],
};
