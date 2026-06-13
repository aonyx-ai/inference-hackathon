// Real end-to-end test of the full chat-to-artifact loop. It drives the actual
// webview: the opening prompt makes the orchestrator reply and spins up a domain
// artifact, then we open that artifact and ask its agent to grow the model, and
// watch the graph re-render and re-lay-out. Every reply is a genuine model call
// routed through the planner's Mastra server (booted by wdio.conf's onPrepare
// and reached via the VITE_API_BASE the app was built with), so this exercises
// the whole path — composer, session state, fetch, both agents, and render.
//
// This is one continuous spec on purpose: the embedded WebDriver server drives a
// single, persistent app instance with no reset between specs, so the artifact
// flow continues from where the orchestrator flow leaves off rather than living
// in a second spec that would inherit this one's navigation.

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

describe("orchestrator chat", () => {
  it("replies, spins up a domain artifact, then edits and re-lays-out its graph", async () => {
    const task = await browser.$(".task__goal");
    await task.waitForExist({ timeout: 10_000 });

    const feedSizeBefore = await browser.$$("li.message").length;

    const input = await browser.$("input.composer__input");
    await input.waitForExist({ timeout: 10_000 });
    const prompt = "Let users export their dashboard as a PDF";
    await input.setValue(prompt);

    const send = await browser.$("button.composer__send");
    await send.click();

    // The developer's message appears immediately, then the orchestrator's
    // reply (a live model call through the planner) lands as another bubble, so
    // the feed grows by two. The generous timeout covers the model round-trip.
    await browser.waitUntil(
      async () => (await browser.$$("li.message").length) >= feedSizeBefore + 2,
      {
        timeout: 45_000,
        interval: 500,
        timeoutMsg: "Orchestrator reply never appeared in the feed",
      },
    );

    // The newest "mine" bubble carries exactly what we typed. (We read text
    // rather than use a `=text` selector, which the embedded WebKit driver
    // rejects.)
    const mineTexts = await browser
      .$$(".message--mine .message__text")
      .map((el) => el.getText());
    if (!mineTexts.includes(prompt)) {
      throw new Error(
        `Sent message not found in feed. Saw: ${JSON.stringify(mineTexts)}`,
      );
    }

    // The opening prompt also spins up the domain artifact, which lands in the
    // deck as a domain card once the modeler returns. Open it.
    const domainCard = await browser.$(".card--domain");
    await domainCard.waitForExist({ timeout: 45_000 });
    await domainCard.click();

    // Its graph is on the canvas. A domain model has several entities, so the
    // renderer must spread them across more than one column — anything but a
    // single stacked column means the edges can be read rather than piling onto
    // one vertical line.
    const firstNode = await browser.$(".graph__node");
    await firstNode.waitForExist({ timeout: 10_000 });
    const nodeCountBefore = await browser.$$(".graph__node").length;
    if (new Set(await nodeLefts()).size <= 1) {
      throw new Error("Generated graph collapsed into a single column");
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
