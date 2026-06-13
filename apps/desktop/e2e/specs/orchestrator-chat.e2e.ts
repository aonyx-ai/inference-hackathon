// Real end-to-end test of the disk-to-edit loop. It drives the actual webview:
// the codebase's domain artifact loads from disk on start, we open it, and ask
// its agent to grow the model, watching the graph re-render and re-lay-out. The
// edit is a genuine model call routed through the planner's Mastra server (booted
// by wdio.conf's onPrepare and reached via the VITE_API_BASE the app was built
// with), so this exercises the path — disk load, parse to graph, render, the
// domain agent, and re-render.
//
// It deliberately edits the artifact directly rather than sending an opening
// prompt first: the opening prompt kicks off the repo-research grounding, which
// also edits this same graph in the background, and racing the two would make the
// node count nondeterministic. Research grounding is covered on its own.

/** The `left` style of every rendered graph node, e.g. ["50%", "79.4%"]. */
async function nodeLefts(): Promise<string[]> {
  const styles = await browser
    .$$(".graph__node")
    .map((el) => el.getAttribute("style"));
  return styles.map((style) => {
    const match = /left:\s*([^;]+)/.exec(style ?? "");
    return match?.[1]?.trim() ?? "";
  });
}

describe("disk artifacts", () => {
  it("loads the domain and architecture graphs from disk, then edits one", async () => {
    const task = await browser.$(".task__goal");
    await task.waitForExist({ timeout: 10_000 });

    // The codebase's domain and architecture artifacts both arrive from disk on
    // start — no prompt needed. (The architecture graph is parsed from a Mermaid
    // flowchart, the domain graph from a class diagram.)
    await browser.$(".card--architecture").waitForExist({ timeout: 20_000 });
    const domainCard = await browser.$(".card--domain");
    await domainCard.waitForExist({ timeout: 20_000 });
    await domainCard.click();

    // Its graph is on the canvas. A domain model has several entities, so the
    // renderer must spread them across more than one column — anything but a
    // single stacked column means the edges can be read rather than piling onto
    // one vertical line.
    const firstNode = await browser.$(".graph__node");
    await firstNode.waitForExist({ timeout: 10_000 });
    const nodeCountBefore = await browser.$$(".graph__node").length;
    if (new Set(await nodeLefts()).size <= 1) {
      throw new Error("Domain graph collapsed into a single column");
    }

    // Ask the artifact's agent for a clearly new entity, so the model has to add
    // to the graph rather than restate it.
    const agentInput = await browser.$("input.composer__input");
    await agentInput.waitForExist({ timeout: 10_000 });
    await agentInput.setValue(
      "Add a Notification entity that a User receives when an export finishes.",
    );
    await browser.$("button.composer__send").click();

    // The edit returns the full updated graph, which lands as more nodes on the
    // canvas — proving the artifact re-rendered from the agent's reply.
    await browser.waitUntil(
      async () => (await browser.$$(".graph__node").length) > nodeCountBefore,
      {
        timeout: 60_000,
        interval: 1_000,
        timeoutMsg: "The graph never grew after the agent's edit",
      },
    );

    // Re-jigged, not collapsed: the larger graph still spreads across more than
    // one column, so its edges don't pile onto a single vertical line.
    if (new Set(await nodeLefts()).size <= 1) {
      throw new Error("Nodes collapsed into a single column after editing");
    }
  });
});
