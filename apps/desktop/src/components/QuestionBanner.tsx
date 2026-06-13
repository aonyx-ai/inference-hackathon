/**
 * Shown on an artifact when its agent bubbled a question up for the developer.
 * Where the drift banner warns that a surface may have gone stale, this asks for
 * a decision only the developer can make — answered by replying to the agent in
 * the thread alongside it.
 */
export function QuestionBanner({ question }: { question: string }) {
  return (
    <output className="question">
      <span className="question__icon" aria-hidden="true">
        ?
      </span>
      <span className="question__text">{question}</span>
    </output>
  );
}
