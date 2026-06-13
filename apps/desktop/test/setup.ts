import { GlobalRegistrator } from "@happy-dom/global-registrator";

// Register a happy-dom global environment so React can render into a real DOM.
// This must run before any Testing Library module is imported: @testing-library
// captures `document` at module-evaluation time, so registering the DOM first
// avoids it binding to an undefined global.
GlobalRegistrator.register();

// React's test utilities expect this flag to be set in non-browser
// environments; without it React logs noisy "not wrapped in act(...)" warnings.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const { afterEach, expect } = await import("bun:test");
const matchers = await import("@testing-library/jest-dom/matchers");
const { cleanup } = await import("@testing-library/react");

// Wire up jest-dom's matchers (toBeInTheDocument, toHaveTextContent, ...) onto
// bun's expect. The bare "@testing-library/jest-dom" import only auto-extends
// Jest/Vitest, so we extend explicitly here.
expect.extend(matchers);

// Unmount rendered components between tests to avoid DOM leakage.
afterEach(() => {
  cleanup();
});
