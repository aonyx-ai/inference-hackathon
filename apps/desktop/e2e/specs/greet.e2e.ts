// Real-backend end-to-end test: drives the actual webview through the
// embedded WebDriver server and asserts the round-trip to the real Rust
// `greet` command, ACL and all.
//
// Interactions go through script execution (`browser.execute`) rather than the
// WebDriver element protocol (`findElement`/`click`/`setValue`). WebKitGTK's
// embedded driver rejects POST /element ("Unsupported result type"), so the
// element protocol is not portable; script evaluation behaves the same on
// WKWebView (macOS) and WebKitGTK (Linux).

const GREETING = "Hello, Tauri! You've been greeted from Rust!";

describe("greet round-trip", () => {
  it("renders the Rust-produced greeting after submitting a name", async () => {
    // Wait for the app to have rendered its UI into the webview.
    await browser.waitUntil(
      () =>
        browser.execute(() => document.querySelector("#greet-input") !== null),
      { timeout: 10_000, timeoutMsg: "The greet form never rendered" },
    );

    // Type a name and submit. The native value setter plus an `input` event is
    // required so React's controlled input registers the change.
    await browser.execute(() => {
      const input = document.querySelector("#greet-input") as HTMLInputElement;
      const setValue = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )!.set!;
      setValue.call(input, "Tauri");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      (
        document.querySelector('button[type="submit"]') as HTMLButtonElement
      ).click();
    });

    // The greeting is produced by the real Rust command over IPC, then rendered.
    await browser.waitUntil(
      async () =>
        (
          await browser.execute(
            () => document.querySelector("main")?.textContent ?? "",
          )
        ).includes(GREETING),
      {
        timeout: 10_000,
        timeoutMsg: `Expected the page to render: ${GREETING}`,
      },
    );

    const pageText = await browser.execute(
      () => document.querySelector("main")?.textContent ?? "",
    );
    expect(pageText).toContain(GREETING);
  });
});
