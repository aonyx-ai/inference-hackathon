import type { Plan } from "@inference-hackathon/core";

/**
 * Renders the synthesized plan: a short overview of the change followed by the
 * ordered steps, numbered the way you'd build them. It's the read-out at the
 * end of scoping — what a coding agent would pick up and run with.
 */
export function PlanView({ plan }: { plan: Plan }) {
  return (
    <article className="plan-view">
      <p className="plan-view__overview">{plan.overview}</p>
      <ol className="plan-view__steps">
        {plan.steps.map((step, index) => (
          <li key={index} className="plan-step">
            <span className="plan-step__index">{index + 1}</span>
            <div className="plan-step__body">
              <h3 className="plan-step__title">{step.title}</h3>
              <p className="plan-step__detail">{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </article>
  );
}
