// Real-app end-to-end test: drives the actual webview through the embedded
// WebDriver server and exercises the orchestration -> artifact-screen
// navigation that the interface is built around.

describe("orchestration navigation", () => {
  it("opens an artifact agent screen from a card and returns", async () => {
    // The webview already has the app loaded on the orchestration screen, so
    // we wait for the UI rather than navigating. An explicit `browser.url(...)`
    // is not portable: WebKitGTK's embedded driver rejects POST /url.
    const task = await browser.$(".task__goal");
    await task.waitForExist({ timeout: 10_000 });

    // Open the first artifact; this is client-side navigation within the
    // already-loaded app, so it does not hit the unsupported driver /url path.
    const card = await browser.$(".card");
    await card.waitForExist({ timeout: 10_000 });
    await card.click();

    // The artifact agent screen shows a back control and the agent composer.
    const back = await browser.$("button.back");
    await back.waitForExist({ timeout: 10_000 });
    const agentInput = await browser.$('input[placeholder="Ask this agent…"]');
    await agentInput.waitForExist({ timeout: 10_000 });

    // Returning lands back on the orchestration screen.
    await back.click();
    const taskAgain = await browser.$(".task__goal");
    await taskAgain.waitForExist({ timeout: 10_000 });
  });
});
