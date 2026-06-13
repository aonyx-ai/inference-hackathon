import { createTool } from "@mastra/core/tools";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { z } from "zod";

/**
 * Read-only filesystem tools that let a research agent explore a target
 * repository. Every tool is bound to a single `root` and refuses to read
 * outside it: paths are resolved against the root and rejected if they escape,
 * so a model that asks for `../../etc/passwd` gets an error rather than a leak.
 *
 * The research agents only ever read — there is no write tool by design. The
 * point of the stage is to understand the repo, not to change it; the artifact
 * agents downstream propose the changes.
 */

/** Directories that are noise for understanding how a repo works. */
const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "target",
  ".next",
  ".turbo",
  "coverage",
]);

/** Cap a single file read so one fat lockfile can't blow the context window. */
const MAX_FILE_BYTES = 60_000;
/** Bound the search so a broad query stays cheap and predictable. */
const MAX_SEARCH_MATCHES = 60;
const MAX_SEARCH_FILES = 4_000;

/**
 * Resolve `path` (relative to the repo root) and confirm it stays inside the
 * root. Returns the absolute path, or throws if the path escapes the sandbox.
 */
export function resolveWithinRoot(root: string, path: string): string {
  const absoluteRoot = resolve(root);
  const candidate = resolve(absoluteRoot, path);
  const rel = relative(absoluteRoot, candidate);
  if (rel === "") return candidate;
  if (rel === ".." || rel.startsWith(`..${sep}`)) {
    throw new Error(`Path escapes the repository root: ${path}`);
  }
  return candidate;
}

/** Recursively collect file paths under `dir`, skipping ignored directories. */
async function walk(
  dir: string,
  out: string[],
  budget: { left: number },
): Promise<void> {
  if (budget.left <= 0) return;
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (budget.left <= 0) return;
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      await walk(join(dir, entry.name), out, budget);
    } else if (entry.isFile()) {
      out.push(join(dir, entry.name));
      budget.left -= 1;
    }
  }
}

/** Heuristic: treat a chunk as binary if it carries a NUL byte. */
function looksBinary(text: string): boolean {
  return text.indexOf(String.fromCharCode(0)) !== -1;
}

/**
 * Build the read-only exploration tools bound to `root`. Returned as a map keyed
 * by tool id so it drops straight into an `Agent`'s `tools` option.
 */
export function repoTools(root: string) {
  const listFiles = createTool({
    id: "list_files",
    description:
      "List the entries of a directory in the repository. Directories end " +
      "with a slash. Use this to map the project before reading files.",
    inputSchema: z.object({
      dir: z
        .string()
        .default(".")
        .describe("Directory relative to the repo root, e.g. '.' or 'src'"),
    }),
    outputSchema: z.object({
      entries: z.array(z.string()),
    }),
    execute: async ({ dir }) => {
      const absolute = resolveWithinRoot(root, dir);
      const entries = await readdir(absolute, { withFileTypes: true });
      return {
        entries: entries
          .filter((entry) => !IGNORED_DIRS.has(entry.name))
          .map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name))
          .sort(),
      };
    },
  });

  const readFileTool = createTool({
    id: "read_file",
    description:
      "Read a UTF-8 text file from the repository. Output is truncated past " +
      `${MAX_FILE_BYTES} bytes. Read a file before claiming how it works.`,
    inputSchema: z.object({
      path: z.string().describe("File path relative to the repo root"),
    }),
    outputSchema: z.object({
      path: z.string(),
      content: z.string(),
      truncated: z.boolean(),
    }),
    execute: async ({ path }) => {
      const absolute = resolveWithinRoot(root, path);
      const info = await stat(absolute);
      if (!info.isFile()) {
        throw new Error(`Not a file: ${path}`);
      }
      const buffer = await readFile(absolute);
      const truncated = buffer.byteLength > MAX_FILE_BYTES;
      const content = buffer.toString("utf8", 0, MAX_FILE_BYTES);
      if (looksBinary(content)) {
        throw new Error(`Refusing to read a binary file: ${path}`);
      }
      return { path, content, truncated };
    },
  });

  const searchRepo = createTool({
    id: "search_repo",
    description:
      "Search the repository's text files for a regular expression and return " +
      "matching lines as `path:line: text`. Use this to find where a concept " +
      "lives before reading whole files.",
    inputSchema: z.object({
      query: z.string().describe("A JavaScript regular expression"),
      flags: z
        .string()
        .default("i")
        .describe("Regex flags, defaults to case-insensitive"),
    }),
    outputSchema: z.object({
      matches: z.array(z.string()),
      truncated: z.boolean(),
    }),
    execute: async ({ query, flags }) => {
      let regex: RegExp;
      try {
        regex = new RegExp(query, flags.includes("g") ? flags : `${flags}g`);
      } catch (error) {
        throw new Error(
          `Invalid regular expression: ${
            error instanceof Error ? error.message : String(error)
          }`,
          { cause: error },
        );
      }
      const absoluteRoot = resolve(root);
      const files: string[] = [];
      await walk(absoluteRoot, files, { left: MAX_SEARCH_FILES });

      const matches: string[] = [];
      for (const file of files) {
        if (matches.length >= MAX_SEARCH_MATCHES) break;
        let text: string;
        try {
          const buffer = await readFile(file);
          if (buffer.byteLength > MAX_FILE_BYTES * 4) continue;
          text = buffer.toString("utf8");
        } catch {
          continue;
        }
        if (looksBinary(text)) continue;
        const lines = text.split("\n");
        for (let i = 0; i < lines.length; i++) {
          regex.lastIndex = 0;
          if (regex.test(lines[i]!)) {
            matches.push(
              `${relative(absoluteRoot, file)}:${i + 1}: ${lines[i]!.trim()}`,
            );
            if (matches.length >= MAX_SEARCH_MATCHES) break;
          }
        }
      }
      return { matches, truncated: matches.length >= MAX_SEARCH_MATCHES };
    },
  });

  return {
    list_files: listFiles,
    read_file: readFileTool,
    search_repo: searchRepo,
  };
}
