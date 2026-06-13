import { expect, test } from "bun:test";

import { greet } from "./index.ts";

test("greet includes the given name", () => {
  expect(greet("world")).toContain("world");
});
