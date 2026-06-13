import type { MastraModelConfig } from "@mastra/core/llm";

/**
 * Model wiring for the planner. Two providers are available, both keyed off the
 * environment variables documented in `.env.example`:
 *
 *   - Anthropic, through Mastra's model router. Passing an `anthropic/<model>`
 *     id makes the router read `ANTHROPIC_API_KEY` automatically.
 *   - Nebius AI Studio, an OpenAI-compatible endpoint. We hand Mastra an
 *     explicit `{ providerId, modelId, url, apiKey }` config so any Nebius-hosted
 *     model works, whether or not it is in the router's catalog.
 *
 * `orchestratorModel` chooses between them from the environment, so the running
 * provider can be flipped without touching code.
 */

const NEBIUS_BASE_URL = "https://api.studio.nebius.com/v1";

const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-6";
const DEFAULT_NEBIUS_MODEL = "meta-llama/Llama-3.3-70B-Instruct";

export type ModelProvider = "anthropic" | "nebius";

/** Claude through the model router; reads `ANTHROPIC_API_KEY` from the env. */
export function anthropicModel(
  model: string = process.env.ANTHROPIC_MODEL ?? DEFAULT_ANTHROPIC_MODEL,
): MastraModelConfig {
  return `anthropic/${model}`;
}

/** A Nebius-hosted model over its OpenAI-compatible endpoint. */
export function nebiusModel(
  modelId: string = process.env.NEBIUS_MODEL ?? DEFAULT_NEBIUS_MODEL,
): MastraModelConfig {
  return {
    providerId: "nebius",
    modelId,
    url: NEBIUS_BASE_URL,
    apiKey: process.env.NEBIUS_API_KEY,
  };
}

/**
 * The model that backs the orchestrator agent. Defaults to Anthropic — the
 * agent runtime — and switches to Nebius when `ORCHESTRATOR_PROVIDER=nebius`.
 */
export function orchestratorModel(): MastraModelConfig {
  const provider = (process.env.ORCHESTRATOR_PROVIDER ??
    "anthropic") as ModelProvider;
  return provider === "nebius" ? nebiusModel() : anthropicModel();
}
