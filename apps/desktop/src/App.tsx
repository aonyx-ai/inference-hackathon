import { Route, Routes } from "react-router-dom";
import { OrchestrationScreen } from "./screens/OrchestrationScreen";
import { ArtifactScreen } from "./screens/ArtifactScreen";
import "./App.css";

/**
 * Routes map to nothing native in Tauri — the webview is a browser, so this is
 * plain client-side routing. The orchestration and artifact screens are two
 * sibling screens you move between.
 */
function App() {
  return (
    <Routes>
      <Route path="/" element={<OrchestrationScreen />} />
      <Route path="/artifact/:artifactId" element={<ArtifactScreen />} />
    </Routes>
  );
}

export default App;
