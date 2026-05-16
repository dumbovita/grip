import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildFilename, buildOriginalFilename, isSameImageFormat } from "./conversion.ts";

const photoUrl = "https://litterbox.catbox.moe/resources/qts/1428178080167.png";
const photoDataUrl = `data:image/png;base64,${readFileSync("test/fixtures/1428178080167.test.png", "base64")}`;

test("buildFilename preserves the real photo URL basename and replaces the extension", () => {
  assert.equal(buildFilename(photoUrl, "jpeg"), "1428178080167.jpg");
});

test("buildFilename falls back to a target-format name for a real photo data URL", () => {
  assert.equal(buildFilename(photoDataUrl, "webp"), "image.webp");
});

test("buildOriginalFilename preserves the real photo data URL format", () => {
  assert.equal(buildOriginalFilename(photoDataUrl), "image.png");
});

test("isSameImageFormat detects when original bytes already satisfy the requested format", () => {
  assert.equal(isSameImageFormat("image/jpeg", "jpeg"), true);
  assert.equal(isSameImageFormat("IMAGE/JPEG; charset=binary", "jpeg"), true);
  assert.equal(isSameImageFormat("image/png", "png"), true);
  assert.equal(isSameImageFormat("image/webp", "webp"), true);
  assert.equal(isSameImageFormat("image/webp", "jpeg"), false);
});
