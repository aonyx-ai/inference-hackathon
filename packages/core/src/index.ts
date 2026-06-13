/**
 * Shared core for the inference hackathon monorepo.
 *
 * This is a placeholder surface so the workspace, type-checker, and tests have
 * something real to chew on. Replace it with the actual inference primitives.
 */

export interface InferenceRequest {
  prompt: string;
}

export interface InferenceResponse {
  text: string;
}

export function greet(name: string): string {
  return `hello from @inference-hackathon/core, ${name}`;
}

export * from "./scoping";
