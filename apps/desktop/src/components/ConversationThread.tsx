import type { ChatMessage } from "@inference-hackathon/core";
import { Composer } from "./Composer";
import { Message } from "./Message";

interface ConversationThreadProps {
  title: string;
  messages: ChatMessage[];
  placeholder: string;
  onSend: (text: string) => void;
  /** True while the agent is generating a reply; blocks input and shows a hint. */
  pending?: boolean;
}

/** A self-contained chat pane: header, messages, and a composer. */
export function ConversationThread({
  title,
  messages,
  placeholder,
  onSend,
  pending = false,
}: ConversationThreadProps) {
  return (
    <section className="thread">
      <header className="thread__header">
        <h2 className="thread__title">{title}</h2>
      </header>
      <ol className="thread__messages">
        {messages.map((message) => (
          <Message key={message.id} message={message} />
        ))}
      </ol>
      {pending && <p className="thread__pending">Agent is thinking…</p>}
      <Composer placeholder={placeholder} onSend={onSend} disabled={pending} />
    </section>
  );
}
