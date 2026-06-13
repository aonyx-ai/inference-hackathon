// Real-backend end-to-end test: drives the actual webview through the
// embedded WebDriver server and asserts the round-trip to the real Rust
// `greet` command, ACL and all.

describe("greet round-trip", () => {
  it("renders the Rust-produced greeting after submitting a name", async () => {
    // The webview is already showing the app, but navigating makes the spec
    // robust to whatever the server's initial URL is. `tauri://localhost`
    // is the app's own origin on macOS/iOS; on Linux/Windows the embedded
    // server resolves it to the loaded frontend just the same.
    await browser.url("tauri://localhost");

    const input = await browser.$("#greet-input");
    await input.waitForExist({ timeout: 10_000 });
    await input.setValue("Tauri");

    const greetButton = await browser.$('button[type="submit"]');
    await greetButton.click();

    const expected = "Hello, Tauri! You've been greeted from Rust!";

    await browser.waitUntil(
      async () => {
        const text = await browser.$("main").getText();
        return text.includes(expected);
      },
      {
        timeout: 10_000,
        timeoutMsg: `Expected the page to render: ${expected}`,
      },
    );

    const pageText = await browser.$("main").getText();
    expect(pageText).toContain(expected);
  });
});
