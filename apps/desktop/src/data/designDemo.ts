import type { Artifact, DesignScene } from "@inference-hackathon/core";

/**
 * A worked design artifact used to demo the side-by-side surface before a UX
 * agent exists to emit one. It deliberately exercises both axes the IR is meant
 * to cover at once: the proposed scene **adds** a new primary button (a
 * structural change) **and** carries an accent token delta (a theming change),
 * so the same diff proves the abstraction isn't limited to swapping a color.
 *
 * Both scenes share node ids for everything unchanged, so the renderer outlines
 * only what actually differs.
 */
function dashboardScene({ withShare }: { withShare: boolean }): DesignScene {
  return {
    screen: "Project Dashboard",
    root: {
      id: "card",
      component: "card",
      children: [
        {
          id: "header",
          component: "header",
          children: [
            {
              id: "heading",
              component: "heading",
              props: { label: "Acme Dashboard" },
            },
            { id: "badge", component: "badge", props: { label: "Live" } },
          ],
        },
        {
          id: "summary",
          component: "text",
          props: { label: "Your team shipped 12 changes this week." },
        },
        {
          id: "search",
          component: "field",
          props: { label: "Search", placeholder: "Filter projects…" },
        },
        {
          id: "list",
          component: "list",
          children: [
            {
              id: "item-1",
              component: "listItem",
              props: { label: "Billing service — 4 open tasks" },
            },
            {
              id: "item-2",
              component: "listItem",
              props: { label: "Mobile app — 2 open tasks" },
            },
          ],
        },
        {
          id: "actions",
          component: "row",
          children: [
            {
              id: "settings-btn",
              component: "button",
              props: { label: "Settings", variant: "secondary" },
            },
            ...(withShare
              ? [
                  {
                    id: "share-btn",
                    component: "button" as const,
                    props: { label: "Share" },
                    change: "added" as const,
                  },
                ]
              : []),
            {
              id: "new-btn",
              component: "button",
              props: { label: "New project" },
            },
          ],
        },
      ],
    },
  };
}

export const designDemoArtifact: Artifact = {
  id: "ux-design-demo",
  kind: "ux",
  title: "Refresh the dashboard accent and add Share",
  summary:
    "Swaps the primary accent from terracotta to blue and adds a Share action beside the dashboard's primary buttons.",
  status: "ready",
  conversation: [
    {
      id: "ux-design-demo-1",
      author: "ux",
      text: "Here's the dashboard with the new accent and a Share action. The proposed pane recolors every accented component and outlines the new button so you can approve both at a glance.",
      at: "2026-06-13T09:02:00Z",
    },
  ],
  body: {
    type: "design",
    before: dashboardScene({ withShare: false }),
    after: dashboardScene({ withShare: true }),
    tokens: [
      { name: "--accent", before: "#c96442", after: "#3b6ea5" },
      { name: "--accent-ink", before: "#8c3e22", after: "#27506f" },
    ],
  },
};
