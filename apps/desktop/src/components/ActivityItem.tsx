import type { ActivityEvent } from "@inference-hackathon/core";
import { artifactKindLabel } from "@inference-hackathon/core";

/** The uppercase tag shown alongside an activity entry. */
export function activityLabel(event: ActivityEvent): string {
  switch (event.kind) {
    case "research":
      return "Research";
    case "draft":
      return event.from ? `${artifactKindLabel(event.from)} agent` : "Agent";
    case "decision-raised":
      return event.from
        ? `${artifactKindLabel(event.from)} agent needs input`
        : "Needs input";
    case "decision-resolved":
      return "Resolved";
  }
}

/**
 * One entry in the orchestrator activity feed. An unanswered decision wears the
 * accent as a "needs input" call to action; everything else is calmer history.
 * Entries that name an artifact open it when clicked.
 */
export function ActivityItem({
  event,
  resolved = false,
  onOpen,
}: {
  event: ActivityEvent;
  /** Whether the decision this entry raised has since been answered. */
  resolved?: boolean;
  onOpen?: (artifactId: string) => void;
}) {
  const label = activityLabel(event);
  const open = () => {
    if (event.artifactId) onOpen?.(event.artifactId);
  };

  if (event.kind === "decision-raised" && !resolved) {
    return (
      <button className="activity-item" onClick={open}>
        <span className="activity-item__label">{label}</span>
        <span className="activity-item__text">{event.text}</span>
      </button>
    );
  }

  const className = `activity-event${event.pending ? " activity-event--pending" : ""}`;
  const body = (
    <>
      <span className="activity-event__label">{label}</span>
      <span className="activity-event__text">{event.text}</span>
    </>
  );

  return event.artifactId ? (
    <button className={className} onClick={open}>
      {body}
    </button>
  ) : (
    <div className={className}>{body}</div>
  );
}
