import type { Browser } from "wxt/browser";
import type { ConvertFormat, ConvertResponse } from "../src/types";
import { blobToDataUrl, buildFilename, convertImage, isSameImageFormat, sniffImageFormat } from "../src/conversion";
import { buildOriginalDownload, dataUrlToBlob, withSubfolder } from "../src/download";
import { formatForMenuItem, menuItems } from "../src/menus";
import { loadSettings, type Settings } from "../src/settings";

type FetchedImage =
  | { kind: "convert"; dataUrl: string }
  | { kind: "download-original-url" }
  | { kind: "download-original-blob"; blob: Blob };

export default defineBackground(() => {
  const displayMap: Record<ConvertFormat, string> = { png: "PNG", jpeg: "JPG", webp: "WebP" };

  let offscreenPromise: Promise<void> | null = null;
  let activeConversions = 0;
  let closeTimeout: ReturnType<typeof setTimeout> | null = null;
  let notificationCounter = 0;

  function notify(message: string): void {
    const id = `grip-${Date.now()}-${++notificationCounter}`;
    browser.notifications
      .create(id, {
        type: "basic",
        iconUrl: "icons/icon48.png",
        title: "grip",
        message,
      })
      .catch((err) => {
        console.error("grip: notification failed:", err);
      });
  }

  async function flashBadge(): Promise<void> {
    const action = import.meta.env.MANIFEST_VERSION === 2 ? browser.browserAction : browser.action;
    await action.setBadgeBackgroundColor({ color: "#2e7d46" });
    await action.setBadgeText({ text: "✓" });
    setTimeout(() => action.setBadgeText({ text: "" }), 2000);
  }

  async function rebuildMenus(): Promise<void> {
    try {
      const settings = await loadSettings();
      await browser.contextMenus.removeAll();
      for (const item of menuItems(settings)) {
        await browser.contextMenus.create({ ...item, contexts: ["image"] });
      }
    } catch (err) {
      console.error("grip: failed to register context menus:", err);
    }
  }

  async function acquireOffscreenDocument(): Promise<void> {
    if (closeTimeout) {
      clearTimeout(closeTimeout);
      closeTimeout = null;
    }
    activeConversions++;

    if (await browser.offscreen.hasDocument()) return;

    offscreenPromise ??= browser.offscreen
      .createDocument({
        url: "offscreen.html",
        reasons: ["BLOBS"],
        justification: "Convert image to target format using Canvas API",
      })
      .finally(() => {
        offscreenPromise = null;
      });

    await offscreenPromise;
  }

  function releaseOffscreenDocument(): void {
    activeConversions = Math.max(0, activeConversions - 1);
    if (activeConversions > 0) return;

    if (closeTimeout) clearTimeout(closeTimeout);
    closeTimeout = setTimeout(async () => {
      closeTimeout = null;
      if (activeConversions === 0 && (await browser.offscreen.hasDocument())) {
        try {
          await browser.offscreen.closeDocument();
        } catch {
          // Ignore
        }
      }
    }, 10000);
  }

  async function startDownload(options: Browser.downloads.DownloadOptions, settings: Settings): Promise<number | null> {
    try {
      if (import.meta.env.MANIFEST_VERSION === 3) {
        return await browser.downloads.download({ ...options, conflictAction: settings.conflictAction });
      }
      return await browser.downloads.download(options);
    } catch (err) {
      console.error("grip: download failed:", err);
      if (settings.feedback !== "off") notify("Could not save image — download failed");
      return null;
    }
  }

  async function downloadBlob(blob: Blob, filename: string, settings: Settings): Promise<boolean> {
    const objectUrl = URL.createObjectURL(blob);
    const downloadId = await startDownload({ url: objectUrl, filename }, settings);

    if (downloadId === null) {
      URL.revokeObjectURL(objectUrl);
      return false;
    }

    const cleanup = (delta: Browser.downloads.DownloadDelta) => {
      if (delta.id !== downloadId) return;
      const state = delta.state?.current;
      if (state === "complete" || state === "interrupted") {
        browser.downloads.onChanged.removeListener(cleanup);
        URL.revokeObjectURL(objectUrl);
      }
    };

    browser.downloads.onChanged.addListener(cleanup);
    return true;
  }

  async function downloadDataUrl(dataUrl: string, filename: string, settings: Settings): Promise<boolean> {
    if (import.meta.env.MANIFEST_VERSION === 2) {
      return downloadBlob(await dataUrlToBlob(dataUrl), filename, settings);
    }
    return (await startDownload({ url: dataUrl, filename }, settings)) !== null;
  }

  async function saveOriginal(imageUrl: string, settings: Settings): Promise<void> {
    const downloadId = await startDownload(buildOriginalDownload({ imageUrl, subfolder: settings.subfolder }), settings);
    if (downloadId !== null) await flashBadge();
  }

  async function fetchImage(url: string, targetFormat: ConvertFormat): Promise<FetchedImage> {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const responseMimeType = response.headers.get("content-type") || "";
    const buffer = await response.arrayBuffer();

    if (buffer.byteLength > 47 * 1024 * 1024) {
      throw new Error("Image exceeds 47MB limit");
    }

    const sniffed = sniffImageFormat(buffer);
    const isTarget = sniffed
      ? sniffed === targetFormat
      : isSameImageFormat(responseMimeType, targetFormat);

    if (isTarget) {
      if (import.meta.env.MANIFEST_VERSION === 2) {
        const mimeType = sniffed ? `image/${sniffed}` : responseMimeType || "application/octet-stream";
        return { kind: "download-original-blob", blob: new Blob([buffer], { type: mimeType }) };
      }
      return { kind: "download-original-url" };
    }

    const mimeType = (sniffed ? `image/${sniffed}` : responseMimeType) || "application/octet-stream";
    const dataUrl = await blobToDataUrl(new Blob([buffer], { type: mimeType }));
    return { kind: "convert", dataUrl };
  }

  function qualityFor(format: ConvertFormat, settings: Settings): number | undefined {
    if (format === "jpeg") return settings.jpegQuality / 100;
    if (format === "webp") return settings.webpQuality / 100;
    return undefined;
  }

  async function convertDataUrl(dataUrl: string, originalUrl: string, format: ConvertFormat, settings: Settings): Promise<ConvertResponse> {
    const request = {
      dataUrl,
      originalUrl,
      format,
      quality: qualityFor(format, settings),
      background: settings.jpegBackground,
    };

    if (import.meta.env.MANIFEST_VERSION === 2) {
      try {
        return { ok: true, ...(await convertImage(request)) };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
      }
    }

    await acquireOffscreenDocument();
    try {
      return await Promise.race([
        browser.runtime.sendMessage({ type: "convert", ...request }) as Promise<ConvertResponse>,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Conversion timeout")), 30000),
        ),
      ]);
    } finally {
      releaseOffscreenDocument();
    }
  }

  async function convertAndSave(dataUrl: string, originalUrl: string, targetFormat: ConvertFormat, filename: string, settings: Settings): Promise<boolean> {
    let response: ConvertResponse;
    try {
      response = await convertDataUrl(dataUrl, originalUrl, targetFormat, settings);
    } catch (err) {
      console.error("grip: conversion failed:", err);
      await fallbackToOriginal(originalUrl, targetFormat, settings);
      return false;
    }

    if (!response.ok) {
      console.error("grip: conversion failed:", response.error);
      await fallbackToOriginal(originalUrl, targetFormat, settings);
      return false;
    }

    return downloadDataUrl(response.dataUrl, filename, settings);
  }

  async function fallbackToOriginal(imageUrl: string, targetFormat: ConvertFormat, settings: Settings): Promise<void> {
    const downloadId = await startDownload(buildOriginalDownload({ imageUrl, subfolder: settings.subfolder }), settings);
    if (downloadId !== null && settings.feedback !== "off") {
      notify(`Saved in original format — could not convert to ${displayMap[targetFormat]}`);
    }
  }

  async function reportSave(targetFormat: ConvertFormat, settings: Settings): Promise<void> {
    await flashBadge();
    if (settings.feedback === "all") notify(`Saved as ${displayMap[targetFormat]}`);
  }

  async function saveImageAs(imageUrl: string, targetFormat: ConvertFormat, settings: Settings): Promise<void> {
    const filename = withSubfolder(buildFilename(imageUrl, targetFormat), settings.subfolder);

    if (imageUrl.startsWith("data:")) {
      const sourceMimeType = imageUrl.split(";", 1)[0].split(":")[1] || "";
      if (isSameImageFormat(sourceMimeType, targetFormat)) {
        if (await downloadDataUrl(imageUrl, filename, settings)) await reportSave(targetFormat, settings);
        return;
      }
      if (await convertAndSave(imageUrl, imageUrl, targetFormat, filename, settings)) {
        await reportSave(targetFormat, settings);
      }
      return;
    }

    let fetchedImage: FetchedImage;
    try {
      fetchedImage = await fetchImage(imageUrl, targetFormat);
    } catch (err) {
      console.error("grip: fetch failed:", imageUrl, err);
      await fallbackToOriginal(imageUrl, targetFormat, settings);
      return;
    }

    if (fetchedImage.kind === "download-original-url") {
      const downloadId = await startDownload({ url: imageUrl, filename }, settings);
      if (downloadId !== null) await reportSave(targetFormat, settings);
      return;
    }

    if (fetchedImage.kind === "download-original-blob") {
      if (await downloadBlob(fetchedImage.blob, filename, settings)) await reportSave(targetFormat, settings);
      return;
    }

    if (await convertAndSave(fetchedImage.dataUrl, imageUrl, targetFormat, filename, settings)) {
      await reportSave(targetFormat, settings);
    }
  }

  browser.runtime.onInstalled.addListener(rebuildMenus);
  browser.storage.onChanged.addListener(rebuildMenus);

  browser.contextMenus.onClicked.addListener(async (info) => {
    const imageUrl = info.srcUrl;
    if (!imageUrl) return;

    const settings = await loadSettings();

    if (info.menuItemId === "save-original") {
      await saveOriginal(imageUrl, settings);
      return;
    }

    const targetFormat = formatForMenuItem(info.menuItemId);
    if (targetFormat) await saveImageAs(imageUrl, targetFormat, settings);
  });
});
