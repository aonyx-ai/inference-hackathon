import { expect, mock, test } from "bun:test";
import { renderHook } from "@testing-library/react";

import { useReloadShortcut } from "./useReloadShortcut";

/** Dispatch a keydown on window and hand back the event to inspect afterwards. */
function press(init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    ...init,
    cancelable: true,
    bubbles: true,
  });
  window.dispatchEvent(event);
  return event;
}

test("Cmd+R fires the handler and swallows the browser's own reload", () => {
  const onReload = mock(() => {});
  renderHook(() => useReloadShortcut(onReload));

  const event = press({ key: "r", metaKey: true });

  expect(onReload).toHaveBeenCalledTimes(1);
  expect(event.defaultPrevented).toBe(true);
});

test("Ctrl+R fires the handler off macOS", () => {
  const onReload = mock(() => {});
  renderHook(() => useReloadShortcut(onReload));

  press({ key: "r", ctrlKey: true });

  expect(onReload).toHaveBeenCalledTimes(1);
});

test("R without a modifier is ignored so typing still works", () => {
  const onReload = mock(() => {});
  renderHook(() => useReloadShortcut(onReload));

  const event = press({ key: "r" });

  expect(onReload).not.toHaveBeenCalled();
  expect(event.defaultPrevented).toBe(false);
});

test("Cmd+Shift+R is left to the platform's hard reload", () => {
  const onReload = mock(() => {});
  renderHook(() => useReloadShortcut(onReload));

  press({ key: "R", metaKey: true, shiftKey: true });

  expect(onReload).not.toHaveBeenCalled();
});

test("other Cmd shortcuts pass through untouched", () => {
  const onReload = mock(() => {});
  renderHook(() => useReloadShortcut(onReload));

  press({ key: "s", metaKey: true });

  expect(onReload).not.toHaveBeenCalled();
});

test("the listener is removed on unmount", () => {
  const onReload = mock(() => {});
  const { unmount } = renderHook(() => useReloadShortcut(onReload));

  unmount();
  press({ key: "r", metaKey: true });

  expect(onReload).not.toHaveBeenCalled();
});
