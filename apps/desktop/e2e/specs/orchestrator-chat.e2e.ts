// Real end-to-end test of the chat wiring: drives the actual webview, sends a
// message to the orchestrator, and waits for a reply. The reply is a genuine
// model call routed through the planner's Mastra server (booted by wdio.conf's
// onPrepare and reached via the VITE_API_BASE the app was built with), so this
// exercises the full path — composer, session state, fetch, agent, render.

describe("orchestrator chat", () => {
  it("sends a message and renders the orchestrator's reply", async () => {
    const task = await browser.$(".task__goal");
    await task.waitForExist({ timeout: 10_000 });

    const feedSizeBefore = await browser.$$("li.message").length;

    const input = await browser.$(
      'input[placeholder="Reply to the orchestrator…"]',
    );
    await input.waitForExist({ timeout: 10_000 });
    const prompt = "In one short sentence, what will you scope first?";
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
  });
});
