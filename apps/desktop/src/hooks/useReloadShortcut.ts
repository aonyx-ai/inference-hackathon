import { useEffect } from "react";

/**
 * Bind Cmd+R (Ctrl+R off macOS) to a reload handler. The packaged Tauri webview
 * exposes no native reload shortcut, so this is the way back to a clean slate;
 * in a dev browser it preempts the browser's own reload so the behavior is the
 * same in both. The Shift and Alt variants are left to the platform.
 */
export function useReloadShortcut(onReload: () => void) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const accelerator = event.metaKey || event.ctrlKey;
      if (!accelerator || event.shiftKey || event.altKey) return;
      if (event.key !== "r" && event.key !== "R") return;
      event.preventDefault();
      onReload();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onReload]);
}
