import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildOriginalDownload, dataUrlToBlob, withSubfolder } from "./download.ts";

const photoUrl = "https://upload.wikimedia.org/wikipedia/commons/4/47/PNG_transparency_demonstration_1.png";
const fixturePath = "test/fixtures/1428178080167.test.png";
const photoDataUrl = `data:image/png;base64,${readFileSync(fixturePath, "base64")}`;

test("buildOriginalDownload names the real photo URL download after its basename", () => {
  assert.deepEqual(buildOriginalDownload({ imageUrl: photoUrl, subfolder: "" }), {
    url: photoUrl,
    filename: "PNG_transparency_demonstration_1.png",
  });
});

test("buildOriginalDownload places downloads in the configured subfolder", () => {
  assert.deepEqual(buildOriginalDownload({ imageUrl: photoUrl, subfolder: "grip" }), {
    url: photoUrl,
    filename: "grip/PNG_transparency_demonstration_1.png",
  });
  assert.deepEqual(buildOriginalDownload({ imageUrl: photoDataUrl, subfolder: "images/web" }), {
    url: photoDataUrl,
    filename: "images/web/image.png",
  });
});

test("buildOriginalDownload gives a real photo data URL its original extension", () => {
  assert.deepEqual(buildOriginalDownload({ imageUrl: photoDataUrl, subfolder: "" }), {
    url: photoDataUrl,
    filename: "image.png",
  });
});

test("buildOriginalDownload omits the filename when the URL carries no extension", () => {
  const tweetImage = "https://pbs.twimg.com/media/HQgnynEXQAA9zlX?format=jpg&name=large";
  assert.deepEqual(buildOriginalDownload({ imageUrl: tweetImage, subfolder: "grip" }), {
    url: tweetImage,
  });
});

test("withSubfolder leaves filenames untouched without a subfolder", () => {
  assert.equal(withSubfolder("cat.png", ""), "cat.png");
  assert.equal(withSubfolder("cat.png", "grip"), "grip/cat.png");
});

test("dataUrlToBlob preserves real photo bytes for extension-owned downloads", async () => {
  const fixture = readFileSync(fixturePath);
  const blob = await dataUrlToBlob(photoDataUrl);

  assert.equal(blob.type, "image/png");
  assert.equal(blob.size, fixture.byteLength);
});
