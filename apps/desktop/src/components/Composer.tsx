import { useState, type FormEvent } from "react";

interface ComposerProps {
  placeholder: string;
  onSend: (text: string) => void;
}

/** The prompt input, reused for the orchestrator, agents, and the empty state. */
export function Composer({ placeholder, onSend }: ComposerProps) {
  const [text, setText] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
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
        onChange={(event) => setText(event.currentTarget.value)}
      />
      <button className="composer__send" type="submit" disabled={!text.trim()}>
        Send
      </button>
    </form>
  );
}
