import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { repoTools, resolveWithinRoot } from "./research-tools.ts";

describe("resolveWithinRoot", () => {
  const root = "/repo";

  test("resolves a path inside the root", () => {
    expect(resolveWithinRoot(root, "src/index.ts")).toBe("/repo/src/index.ts");
  });

  test("allows the root itself", () => {
    expect(resolveWithinRoot(root, ".")).toBe("/repo");
  });

  test("rejects a path that escapes the root", () => {
    expect(() => resolveWithinRoot(root, "../secrets")).toThrow(/escapes/);
  });

  test("rejects an absolute path outside the root", () => {
    expect(() => resolveWithinRoot(root, "/etc/passwd")).toThrow(/escapes/);
  });
});

describe("repoTools", () => {
  let root: string;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "research-tools-"));
    await mkdir(join(root, "src"));
    await mkdir(join(root, "node_modules"));
    await writeFile(join(root, "README.md"), "# Demo\n");
    await writeFile(
      join(root, "src", "billing.ts"),
      "export class Invoice {}\nexport class Payment {}\n",
    );
    await writeFile(join(root, "node_modules", "junk.js"), "noise\n");
  });

  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  test("list_files lists entries and hides ignored directories", async () => {
    const { entries } = await repoTools(root).list_files.execute!(
      { dir: "." },
      {} as never,
    );
    expect(entries).toContain("README.md");
    expect(entries).toContain("src/");
    expect(entries).not.toContain("node_modules/");
  });

  test("read_file returns file contents", async () => {
    const result = await repoTools(root).read_file.execute!(
      { path: "src/billing.ts" },
      {} as never,
    );
    expect(result.content).toContain("class Invoice");
    expect(result.truncated).toBe(false);
  });

  test("read_file refuses to escape the root", async () => {
    await expect(
      repoTools(root).read_file.execute!(
        { path: "../../etc/passwd" },
        {} as never,
      ),
    ).rejects.toThrow(/escapes/);
  });

  test("search_repo finds matches and skips node_modules", async () => {
    const { matches } = await repoTools(root).search_repo.execute!(
      { query: "class \\w+", flags: "i" },
      {} as never,
    );
    expect(matches.some((m: string) => m.includes("src/billing.ts"))).toBe(
      true,
    );
    expect(matches.some((m: string) => m.includes("node_modules"))).toBe(false);
  });
});
