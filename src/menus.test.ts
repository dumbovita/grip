import assert from "node:assert/strict";
import test from "node:test";

import { formatForMenuItem, menuItems } from "./menus.ts";
import { defaultSettings, type Settings } from "./settings.ts";

test("menuItems nests every enabled format under a parent when no default is set", () => {
  assert.deepEqual(menuItems(defaultSettings), [
    { id: "grip-parent", title: "Save Image As" },
    { id: "save-png", title: "Save as PNG", parentId: "grip-parent" },
    { id: "save-jpg", title: "Save as JPG", parentId: "grip-parent" },
    { id: "save-webp", title: "Save as WebP", parentId: "grip-parent" },
    { id: "save-original", title: "Save Original", parentId: "grip-parent" },
  ]);
});

test("menuItems collapses to a single top-level action when a default format is set", () => {
  const settings: Settings = { ...defaultSettings, defaultFormat: "jpeg" };
  assert.deepEqual(menuItems(settings), [
    { id: "save-jpg", title: "Save as JPG" },
    { id: "save-original", title: "Save Original" },
  ]);
});

test("menuItems respects the visible formats and can hide Save Original", () => {
  const settings: Settings = { ...defaultSettings, formats: ["webp", "png"], showOriginal: false };
  assert.deepEqual(menuItems(settings), [
    { id: "grip-parent", title: "Save Image As" },
    { id: "save-png", title: "Save as PNG", parentId: "grip-parent" },
    { id: "save-webp", title: "Save as WebP", parentId: "grip-parent" },
  ]);
});

test("menuItems uses the default format even when it is not listed as visible", () => {
  const settings: Settings = { ...defaultSettings, defaultFormat: "png", formats: ["webp"] };
  assert.deepEqual(menuItems(settings), [
    { id: "save-png", title: "Save as PNG" },
    { id: "save-original", title: "Save Original" },
  ]);
});

test("formatForMenuItem maps menu ids back to formats and ignores other ids", () => {
  assert.equal(formatForMenuItem("save-png"), "png");
  assert.equal(formatForMenuItem("save-jpg"), "jpeg");
  assert.equal(formatForMenuItem("save-webp"), "webp");
  assert.equal(formatForMenuItem("save-original"), null);
  assert.equal(formatForMenuItem("grip-parent"), null);
});
