import assert from "node:assert/strict";
import test from "node:test";

import { sanitizeSubfolder } from "./settings.ts";

test("sanitizeSubfolder keeps simple relative folders", () => {
  assert.equal(sanitizeSubfolder("grip"), "grip");
  assert.equal(sanitizeSubfolder("images/web"), "images/web");
  assert.equal(sanitizeSubfolder("a\\b"), "a/b");
});

test("sanitizeSubfolder drops unsafe and traversal segments", () => {
  assert.equal(sanitizeSubfolder("../etc"), "etc");
  assert.equal(sanitizeSubfolder("a/./b"), "a/b");
  assert.equal(sanitizeSubfolder("a:<b>*c?"), "abc");
});

test("sanitizeSubfolder trims whitespace and empty input", () => {
  assert.equal(sanitizeSubfolder("  grip  "), "grip");
  assert.equal(sanitizeSubfolder(""), "");
  assert.equal(sanitizeSubfolder("///"), "");
});
