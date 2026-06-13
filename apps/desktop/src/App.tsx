import { Route, Routes } from "react-router-dom";
import { OrchestrationScreen } from "./screens/OrchestrationScreen";
import { ArtifactScreen } from "./screens/ArtifactScreen";
import { useReloadShortcut } from "./hooks/useReloadShortcut";
import "./App.css";

/** Drop all in-memory session state by hard-reloading to the empty home screen. */
function reloadToEmptyPrompt() {
  window.location.assign("/");
}

/**
 * Routes map to nothing native in Tauri — the webview is a browser, so this is
 * plain client-side routing. The orchestration and artifact screens are two
 * sibling screens you move between.
 */
function App() {
  // Cmd+R wipes the session back to a blank prompt, handy for restarting a demo
  // without quitting the app.
  useReloadShortcut(reloadToEmptyPrompt);

  return (
    <Routes>
      <Route path="/" element={<OrchestrationScreen />} />
      <Route path="/artifact/:artifactId" element={<ArtifactScreen />} />
    </Routes>
  );
}

export default App;
