import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const rowRules = css.split("}")
  .map((rule) => rule.split("{").slice(-2))
  .filter(([selector]) => /(^|[\s,])\.row(?![\w-])/.test(selector))
  .map(([, body]) => body);

test("AC-1: .row uses a 4-column grid and never repeat(8,", () => {
  assert.ok(rowRules.some((body) => /grid-template-columns:\s*repeat\(4,/.test(body)));
  for (const body of rowRules) assert.doesNotMatch(body, /repeat\(8,/);
});
