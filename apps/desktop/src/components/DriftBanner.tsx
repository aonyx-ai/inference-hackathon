/**
 * Shown on an artifact when a change elsewhere may have invalidated it. This
 * is how the orchestrator keeps the surfaces coherent instead of letting three
 * independent agents drift apart.
 */
export function DriftBanner({ reason }: { reason: string }) {
  return (
    <output className="drift">
      <span className="drift__icon" aria-hidden="true">
        ⚠
      </span>
      <span className="drift__reason">{reason}</span>
    </output>
  );
}
