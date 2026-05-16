import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildOriginalDownload, dataUrlToBlob } from "./download.ts";

const photoUrl = "https://litterbox.catbox.moe/resources/qts/1428178080167.png";
const fixturePath = "test/fixtures/1428178080167.test.png";
const photoDataUrl = `data:image/png;base64,${readFileSync(fixturePath, "base64")}`;

test("buildOriginalDownload keeps the real photo URL without unsafe headers", () => {
  assert.deepEqual(buildOriginalDownload({ imageUrl: photoUrl }), {
    url: photoUrl,
  });
});

test("buildOriginalDownload gives a real photo data URL its original extension", () => {
  assert.deepEqual(buildOriginalDownload({ imageUrl: photoDataUrl }), {
    url: photoDataUrl,
    filename: "image.png",
  });
});

test("dataUrlToBlob preserves real photo bytes for extension-owned downloads", async () => {
  const fixture = readFileSync(fixturePath);
  const blob = await dataUrlToBlob(photoDataUrl);

  assert.equal(blob.type, "image/png");
  assert.equal(blob.size, fixture.byteLength);
});
