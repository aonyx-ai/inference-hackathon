import type { ChatMessage } from "@inference-hackathon/core";
import { Composer } from "./Composer";
import { Message } from "./Message";

interface ConversationThreadProps {
  title: string;
  messages: ChatMessage[];
  placeholder: string;
  onSend: (text: string) => void;
}

/** A self-contained chat pane: header, messages, and a composer. */
export function ConversationThread({
  title,
  messages,
  placeholder,
  onSend,
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
      <Composer placeholder={placeholder} onSend={onSend} />
    </section>
  );
}
