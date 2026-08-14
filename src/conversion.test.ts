import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  blobToDataUrl,
  buildFilename,
  buildOriginalFilename,
  isSameImageFormat,
  sniffImageFormat,
} from "./conversion.ts";

const photoUrl = "https://upload.wikimedia.org/wikipedia/commons/4/47/PNG_transparency_demonstration_1.png";
const photoDataUrl = `data:image/png;base64,${readFileSync("test/fixtures/1428178080167.test.png", "base64")}`;

test("buildFilename preserves the real photo URL basename and replaces the extension", () => {
  assert.equal(buildFilename(photoUrl, "jpeg"), "PNG_transparency_demonstration_1.jpg");
  assert.equal(buildFilename(photoUrl, "png"), "PNG_transparency_demonstration_1.png");
  assert.equal(buildFilename(photoUrl, "webp"), "PNG_transparency_demonstration_1.webp");
});

test("buildFilename handles real URLs with query parameters, URL encoding, and paths", () => {
  assert.equal(
    buildFilename("https://avatars.githubusercontent.com/u/9919?v=4", "jpeg"),
    "9919.jpg",
  );
  assert.equal(
    buildFilename("https://upload.wikimedia.org/wikipedia/commons/3/3a/Cat03.jpg", "png"),
    "Cat03.png",
  );
  assert.equal(
    buildFilename("https://upload.wikimedia.org/wikipedia/commons/thumb/6/68/Orange_tabby_cat.jpg/800px-Orange_tabby_cat.jpg", "webp"),
    "800px-Orange_tabby_cat.webp",
  );
  assert.equal(
    buildFilename("https://raw.githubusercontent.com/github/explore/main/topics/javascript/javascript.png", "webp"),
    "javascript.webp",
  );
});

test("buildFilename falls back to a target-format name for a real photo data URL", () => {
  assert.equal(buildFilename(photoDataUrl, "webp"), "image.webp");
  assert.equal(buildFilename(photoDataUrl, "jpeg"), "image.jpg");
});

test("buildFilename sanitizes illegal filesystem characters and path traversal", () => {
  assert.equal(buildFilename("https://upload.wikimedia.org/wiki/special:search/photo:large.png", "jpeg"), "photo_large.jpg");
  assert.equal(buildFilename("https://example.com/foo/bar/../../test.png", "webp"), "test.webp");
  assert.equal(buildFilename("https://example.com/my%20cool%20photo.png", "png"), "my cool photo.png");
  assert.equal(buildFilename("https://example.com/", "jpeg"), "image.jpg");
  assert.equal(buildFilename("not-a-valid-url", "png"), "image.png");
});

test("buildFilename protects against Windows reserved DOS device names", () => {
  assert.equal(buildFilename("https://example.com/aux.png", "jpeg"), "aux_image.jpg");
  assert.equal(buildFilename("https://example.com/con.png", "webp"), "con_image.webp");
  assert.equal(buildFilename("https://example.com/nul.jpg", "png"), "nul_image.png");
  assert.equal(buildFilename("https://example.com/prn.png", "jpeg"), "prn_image.jpg");
  assert.equal(buildFilename("https://example.com/com1.png", "webp"), "com1_image.webp");
});

test("buildOriginalFilename preserves the real photo data URL format and handles diverse MIME types", () => {
  assert.equal(buildOriginalFilename(photoDataUrl), "image.png");
  assert.equal(buildOriginalFilename("data:image/jpeg;base64,123"), "image.jpg");
  assert.equal(buildOriginalFilename("data:image/pjpeg;base64,123"), "image.jpg");
  assert.equal(buildOriginalFilename("data:image/webp;base64,123"), "image.webp");
  assert.equal(buildOriginalFilename("data:image/svg+xml;base64,123"), "image.svg");
  assert.equal(buildOriginalFilename("data:image/x-icon;base64,123"), "image.ico");
  assert.equal(buildOriginalFilename("data:image/avif;base64,123"), "image.avif");
  assert.equal(buildOriginalFilename(photoUrl), undefined);
});

test("isSameImageFormat detects when original bytes already satisfy the requested format", () => {
  assert.equal(isSameImageFormat("image/jpeg", "jpeg"), true);
  assert.equal(isSameImageFormat("IMAGE/JPEG; charset=binary", "jpeg"), true);
  assert.equal(isSameImageFormat("image/pjpeg", "jpeg"), true);
  assert.equal(isSameImageFormat("image/jfif", "jpeg"), true);
  assert.equal(isSameImageFormat("image/png", "png"), true);
  assert.equal(isSameImageFormat("image/x-png", "png"), true);
  assert.equal(isSameImageFormat("image/webp", "webp"), true);
  assert.equal(isSameImageFormat("image/webp", "jpeg"), false);
  assert.equal(isSameImageFormat("image/png", "webp"), false);
});

test("sniffImageFormat accurately detects image format from binary signatures", () => {
  const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]).buffer;
  const jpegHeader = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]).buffer;
  const webpHeader = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]).buffer;
  const unknownHeader = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b]).buffer;
  const shortBuffer = new Uint8Array([0xff, 0xd8]).buffer;

  assert.equal(sniffImageFormat(pngHeader), "png");
  assert.equal(sniffImageFormat(jpegHeader), "jpeg");
  assert.equal(sniffImageFormat(webpHeader), "webp");
  assert.equal(sniffImageFormat(unknownHeader), null);
  assert.equal(sniffImageFormat(shortBuffer), null);
});

test("blobToDataUrl correctly converts a Blob to a base64 data URL", async () => {
  const fixture = readFileSync("test/fixtures/1428178080167.test.png");
  const blob = new Blob([fixture], { type: "image/png" });
  const dataUrl = await blobToDataUrl(blob);

  assert.ok(dataUrl.startsWith("data:image/png;base64,"));
  assert.equal(dataUrl, photoDataUrl);
});


