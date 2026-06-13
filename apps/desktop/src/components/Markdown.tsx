import { openUrl } from "@tauri-apps/plugin-opener";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/* Agents reply in Markdown, so links arrive too. In a Tauri webview a bare
   anchor would navigate the whole app away — hand the URL to the system browser
   instead. */
const components: Components = {
  a({ href, children }) {
    return (
      <a
        href={href}
        onClick={(event) => {
          event.preventDefault();
          if (href) void openUrl(href);
        }}
      >
        {children}
      </a>
    );
  },
};

/**
 * Renders agent-authored Markdown (GFM: tables, task lists, strikethrough) as
 * styled, sanitized output. Raw HTML in the source is escaped, not executed —
 * react-markdown's safe default, which we keep since the text is model output.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
