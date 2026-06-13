import { expect, mock, test } from "bun:test";
import { render, waitFor } from "@testing-library/react";
import type { DomainModel } from "@inference-hackathon/domain";
import { toMermaidDiff } from "@inference-hackathon/domain";

// Mermaid measures and lays out real SVG, which happy-dom can't do, so we stub
// it: the renderer's job is to feed it the right projection and mount what it
// returns, both of which we can assert without a browser. `mode` lets one test
// force the parse failure that drives the fallback.
let mode: "ok" | "throw" = "ok";
const renderMock = mock(async (_id: string, _source: string) => {
  if (mode === "throw") throw new Error("parse error");
  return { svg: "<svg data-testid='diagram'></svg>" };
});
const initialize = mock(() => {});
mock.module("mermaid", () => ({ default: { initialize, render: renderMock } }));

const { DomainArtifact } = await import("./DomainArtifact.tsx");

const model: DomainModel = {
  contexts: [{ id: "core", name: "Core" }],
  entities: [
    {
      id: "user",
      name: "User",
      kind: "AggregateRoot",
      context: "core",
      fields: [
        {
          id: "user.id",
          name: "id",
          type: { kind: "Scalar", name: "UserId" },
          role: "Identity",
        },
      ],
    },
  ],
};

test("projects the model to Mermaid and mounts the returned SVG", async () => {
  mode = "ok";
  const { container } = render(
    <DomainArtifact body={{ type: "domain", baseline: model, model }} />,
  );

  await waitFor(() => expect(renderMock).toHaveBeenCalled());
  // It renders exactly the package's diff projection — the single source of
  // truth for the diagram — not a hand-built one.
  expect(renderMock.mock.calls.at(-1)?.[1]).toBe(toMermaidDiff(model, model));
  await waitFor(() =>
    expect(container.querySelector(".mermaid-diagram svg")).not.toBeNull(),
  );
});

test("falls back to the source when Mermaid can't parse the projection", async () => {
  mode = "throw";
  const { container } = render(
    <DomainArtifact body={{ type: "domain", baseline: model, model }} />,
  );

  await waitFor(() =>
    expect(container.querySelector(".mermaid-diagram--error")).not.toBeNull(),
  );
  expect(
    container.querySelector(".mermaid-diagram--error")?.textContent,
  ).toContain("classDiagram");
  mode = "ok";
});
