import { useState, type FormEvent } from "react";

interface ComposerProps {
  placeholder: string;
  onSend: (text: string) => void;
  /** Block input and sending, e.g. while the agent is generating a reply. */
  disabled?: boolean;
}

/** The prompt input, reused for the orchestrator, agents, and the empty state. */
export function Composer({
  placeholder,
  onSend,
  disabled = false,
}: ComposerProps) {
  const [text, setText] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (disabled) return;
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
  }

  return (
    <form className="composer" onSubmit={submit}>
      <input
        className="composer__input"
        aria-label={placeholder}
        placeholder={placeholder}
        value={text}
        disabled={disabled}
        onChange={(event) => setText(event.currentTarget.value)}
      />
      <button
        className="composer__send"
        type="submit"
        disabled={disabled || !text.trim()}
      >
        Send
      </button>
    </form>
  );
}
