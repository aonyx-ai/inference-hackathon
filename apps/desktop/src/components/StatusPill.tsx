import type { ArtifactStatus } from "@inference-hackathon/core";

const LABELS: Record<ArtifactStatus, string> = {
  drafting: "Drafting",
  "needs-input": "Needs input",
  stale: "May be stale",
  ready: "Ready",
};

/** A single status chip, reused for every artifact and agent state. */
export function StatusPill({ status }: { status: ArtifactStatus }) {
  return (
    <span className={`status-pill status-pill--${status}`}>
      {LABELS[status]}
    </span>
  );
}
