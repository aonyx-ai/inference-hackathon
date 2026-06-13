import type { CSSProperties } from "react";
import type { DesignBody, TokenDelta, UiNode } from "@inference-hackathon/core";

/** Components that wrap children; everything else renders its label as a leaf. */
const CONTAINERS = new Set(["stack", "row", "card", "header", "list"]);

/** Leaf components that render their `label` prop as plain text. */
const LEAVES = new Set(["heading", "text", "badge", "listItem"]);

/**
 * Turn a pane's token deltas into inline CSS custom properties. The proposed
 * pane reads each delta's `after`, the current pane its `before`, so a pane is
 * self-contained and recolors every component beneath it without touching the
 * ambient `:root` theme.
 */
function paneStyle(
  tokens: TokenDelta[] | undefined,
  side: "before" | "after",
): CSSProperties {
  const vars: Record<string, string> = {};
  for (const token of tokens ?? []) vars[token.name] = token[side];
  return vars as CSSProperties;
}

/**
 * Render one node of a design scene as a real, themed element. The diff outline
 * (`design__node--*`) is applied to every node the way {@link GraphDiff} colors
 * its nodes; a component the kit doesn't know renders as a labeled fallback so
 * the scene stays renderable.
 */
function renderNode(node: UiNode) {
  const change = node.change ?? "unchanged";
  const diff = `design__node design__node--${change}`;
  const className = `ui-${node.component} ${diff}`;
  const label = node.props?.label;

  if (CONTAINERS.has(node.component)) {
    return (
      <div key={node.id} className={className}>
        {label ? <span className="ui-label">{label}</span> : null}
        {node.children?.map(renderNode)}
      </div>
    );
  }

  if (node.component === "field") {
    return (
      <div key={node.id} className={className}>
        {label ? <span className="ui-field__label">{label}</span> : null}
        <span className="ui-field__input">{node.props?.placeholder ?? ""}</span>
      </div>
    );
  }

  if (node.component === "button") {
    const variant = node.props?.variant;
    return (
      <div
        key={node.id}
        className={`${className}${variant ? ` ui-button--${variant}` : ""}`}
      >
        {label ?? ""}
      </div>
    );
  }

  if (LEAVES.has(node.component)) {
    return (
      <div key={node.id} className={className}>
        {label ?? ""}
      </div>
    );
  }

  return (
    <div key={node.id} className={`ui-fallback ${diff}`}>
      {label ?? node.component}
    </div>
  );
}

/**
 * A high-fidelity design diff: the current and proposed scenes rendered side by
 * side from a structured component tree. Token deltas (e.g. a new accent) are
 * themed onto each pane via scoped CSS variables, so real components recolor
 * exactly as they would in the app. A legend under the panes spells out the
 * token changes.
 */
export function DesignArtifact({
  body,
  preview = false,
}: {
  body: DesignBody;
  preview?: boolean;
}) {
  const tokens = body.tokens ?? [];

  return (
    <div className={`design ${preview ? "design--preview" : ""}`}>
      <div className="design__panes">
        <section
          className="design__pane"
          style={paneStyle(tokens, "before")}
          aria-label="Current design"
        >
          <span className="design__pane-label">Current</span>
          <div className="design__scene">{renderNode(body.before.root)}</div>
        </section>
        <section
          className="design__pane design__pane--after"
          style={paneStyle(tokens, "after")}
          aria-label="Proposed design"
        >
          <span className="design__pane-label">Proposed</span>
          <div className="design__scene">{renderNode(body.after.root)}</div>
        </section>
      </div>
      {!preview && tokens.length > 0 ? (
        <div className="design__legend">
          {tokens.map((token) => (
            <span key={token.name} className="design__token">
              <code className="design__token-name">{token.name}</code>
              <span
                className="design__swatch"
                style={{ background: token.before }}
              />
              {token.before}
              <span className="design__arrow">→</span>
              <span
                className="design__swatch"
                style={{ background: token.after }}
              />
              {token.after}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
