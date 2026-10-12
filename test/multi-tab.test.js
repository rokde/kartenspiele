import { test } from "node:test";
import assert from "node:assert/strict";
import { isSaveOf } from "../src/core/storage.js";

test("AC-1: isSaveOf matches the save key of the game and a cleared storage only", () => {
  assert.equal(isSaveOf({ key: "karten:offiziersskat" }, "offiziersskat"), true);
  assert.equal(isSaveOf({ key: null }, "offiziersskat"), true);
  for (const key of ["karten:sound", "karten:other", "offiziersskat", "x"]) {
    assert.equal(isSaveOf({ key }, "offiziersskat"), false, key);
  }
});
