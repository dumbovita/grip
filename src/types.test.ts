import assert from "node:assert/strict";
import test from "node:test";

import { formatLabels, type ConvertResponse } from "./types.ts";

test("formatLabels maps all supported formats to display labels", () => {
  assert.equal(formatLabels.png, "PNG");
  assert.equal(formatLabels.jpeg, "JPG");
  assert.equal(formatLabels.webp, "WebP");
});

test("ConvertResponse type contract", () => {
  const success: ConvertResponse = { ok: true, dataUrl: "data:image/png;base64,abc", filename: "image.png" };
  const successNoFilename: ConvertResponse = { ok: true, dataUrl: "data:image/png;base64,abc" };
  const failure: ConvertResponse = { ok: false, error: "Failed to load image" };

  // @ts-expect-error success responses must include converted data.
  const missingDataUrl: ConvertResponse = { ok: true, filename: "image.png" };

  // @ts-expect-error failure responses must include an error.
  const missingError: ConvertResponse = { ok: false };

  assert.equal(success.ok, true);
  assert.equal(successNoFilename.ok, true);
  assert.equal(failure.ok, false);

  void missingDataUrl;
  void missingError;
});
