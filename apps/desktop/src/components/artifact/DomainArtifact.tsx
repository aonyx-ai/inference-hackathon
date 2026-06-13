import { useEffect, useRef, useState } from "react";
import type { DomainBody } from "@inference-hackathon/core";
import { toMermaidDiff } from "@inference-hackathon/domain";
import mermaid from "mermaid";

// Initialize once, on first render rather than at import, so pulling the module
// in has no side effects. `startOnLoad` is off because we render imperatively;
// the neutral theme reads cleanly on the paper-colored canvas.
let initialized = false;
function ensureInitialized() {
  if (initialized) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: "neutral",
    securityLevel: "loose",
  });
  initialized = true;
}

// Each render() call needs a DOM id of its own — Mermaid mounts a temporary node
// under it — so a monotonic counter keeps concurrent and re-render calls apart.
let renderCounter = 0;

/**
 * Render a domain-model artifact as a Mermaid class diagram. The structured
 * model is projected to Mermaid via {@link toMermaidDiff}, overlaying the
 * codebase baseline so added, removed, and modified entities and fields color
 * themselves. Mermaid lays the graph out, so there is no hand-rolled geometry —
 * fields, stereotypes, identity keys, and invariants all survive. If Mermaid
 * can't parse the projection, the raw source is shown so the artifact is never
 * a blank pane.
 */
export function DomainArtifact({
  body,
  preview = false,
}: {
  body: DomainBody;
  preview?: boolean;
}) {
  const source = toMermaidDiff(body.baseline, body.model);
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    ensureInitialized();
    renderCounter += 1;
    mermaid
      .render(`mermaid-${renderCounter}`, source)
      .then(({ svg }) => {
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      })
      .catch((error: unknown) => {
        console.error("Rendering the domain diagram failed:", error);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [source]);

  const className = `mermaid-diagram ${preview ? "mermaid-diagram--preview" : ""}`;

  if (failed) {
    return (
      <pre className={`${className} mermaid-diagram--error`}>{source}</pre>
    );
  }

  return (
    <div ref={containerRef} className={className} aria-label="Domain model" />
  );
}
