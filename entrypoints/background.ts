import type { Browser } from "wxt/browser";
import type { ConvertFormat, ConvertResponse } from "../src/types";
import { buildFilename, convertImage, isSameImageFormat } from "../src/conversion";
import { buildOriginalDownload, dataUrlToBlob } from "../src/download";

type FetchedImage =
  | { kind: "convert"; dataUrl: string }
  | { kind: "download-original-url" }
  | { kind: "download-original-blob"; blob: Blob; filename: string };

export default defineBackground(() => {
  const formatMap: Record<string, ConvertFormat> = { "save-png": "png", "save-jpg": "jpeg", "save-webp": "webp" };
  const displayMap: Record<ConvertFormat, string> = { png: "PNG", jpeg: "JPG", webp: "WebP" };

  let offscreenPending: Promise<void> | null = null;

  function notify(message: string) {
    browser.notifications.create(`grip-${Date.now()}`, {
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: "grip",
      message,
    });
  }

  async function ensureOffscreenDocument() {
    if (await browser.offscreen.hasDocument()) return;

    offscreenPending ??= browser.offscreen
      .createDocument({
        url: "offscreen.html",
        reasons: ["BLOBS"],
        justification: "Convert image to target format using Canvas API",
      })
      .finally(() => {
        offscreenPending = null;
      });

    await offscreenPending;
  }

  async function closeOffscreenDocument() {
    try {
      await browser.offscreen.closeDocument();
    } catch {
      // Ignore errors when closing
    }
  }

  async function downloadBlob(blob: Blob, filename: string) {
    const objectUrl = URL.createObjectURL(blob);
    let downloadId: number;

    try {
      downloadId = await browser.downloads.download({ url: objectUrl, filename });
    } catch (err) {
      URL.revokeObjectURL(objectUrl);
      throw err;
    }

    const cleanup = (delta: Browser.downloads.DownloadDelta) => {
      if (delta.id !== downloadId || !delta.state?.current) return;
      browser.downloads.onChanged.removeListener(cleanup);
      URL.revokeObjectURL(objectUrl);
    };
    browser.downloads.onChanged.addListener(cleanup);
  }

  async function downloadDataUrl(dataUrl: string, filename: string) {
    if (import.meta.env.MANIFEST_VERSION === 2) {
      await downloadBlob(await dataUrlToBlob(dataUrl), filename);
      return;
    }

    await browser.downloads.download({ url: dataUrl, filename });
  }

  async function fetchImage(url: string, targetFormat: ConvertFormat): Promise<FetchedImage> {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const useBlobDownload = import.meta.env.MANIFEST_VERSION === 2;
    const responseMimeType = response.headers.get("content-type") || "";
    if (!useBlobDownload && isSameImageFormat(responseMimeType, targetFormat)) {
      return { kind: "download-original-url" };
    }

    const blob = await response.blob();
    const mimeType = blob.type || responseMimeType || "application/octet-stream";

    if (blob.size > 47 * 1024 * 1024) {
      throw new Error("Image exceeds 47MB limit");
    }

    if (isSameImageFormat(mimeType, targetFormat)) {
      if (useBlobDownload) {
        return { kind: "download-original-blob", blob, filename: buildFilename(url, targetFormat) };
      }
      return { kind: "download-original-url" };
    }

    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const chunks: string[] = [];
    for (let i = 0; i < bytes.length; i += 8192) {
      chunks.push(String.fromCharCode(...bytes.subarray(i, i + 8192)));
    }
    return { kind: "convert", dataUrl: `data:${mimeType};base64,${btoa(chunks.join(""))}` };
  }

  async function convertDataUrl(dataUrl: string, originalUrl: string, format: ConvertFormat): Promise<ConvertResponse> {
    if (import.meta.env.MANIFEST_VERSION === 2) {
      try {
        return { ok: true, ...(await convertImage({ dataUrl, originalUrl, format })) };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Unknown error" };
      }
    } else {
      await ensureOffscreenDocument();
      try {
        return await Promise.race([
          browser.runtime.sendMessage({
            type: "convert",
            dataUrl,
            originalUrl,
            format,
          }) as Promise<ConvertResponse>,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Conversion timeout")), 30000),
          ),
        ]);
      } finally {
        await closeOffscreenDocument();
      }
    }
  }

  browser.runtime.onInstalled.addListener(async () => {
    await browser.contextMenus.removeAll();

    await browser.contextMenus.create({
      id: "grip-parent",
      title: "Save Image As",
      contexts: ["image"],
    });

    await browser.contextMenus.create({
      id: "save-png",
      parentId: "grip-parent",
      title: "Save as PNG",
      contexts: ["image"],
    });

    await browser.contextMenus.create({
      id: "save-jpg",
      parentId: "grip-parent",
      title: "Save as JPG",
      contexts: ["image"],
    });

    await browser.contextMenus.create({
      id: "save-webp",
      parentId: "grip-parent",
      title: "Save as WebP",
      contexts: ["image"],
    });
  });

  browser.contextMenus.onClicked.addListener(async (info) => {
    const targetFormat = formatMap[info.menuItemId];
    if (!targetFormat) return;

    const imageUrl = info.srcUrl;
    if (!imageUrl) return;
    let dataUrl: string;
    const isDataUrl = imageUrl.startsWith("data:");

    if (isDataUrl) {
      dataUrl = imageUrl;
      const sourceMimeType = imageUrl.split(";", 1)[0].split(":")[1] || "";
      if (isSameImageFormat(sourceMimeType, targetFormat)) {
        try {
          await downloadDataUrl(imageUrl, buildFilename(imageUrl, targetFormat));
        } catch (downloadErr) {
          const downloadMessage = downloadErr instanceof Error ? downloadErr.message : "Unknown error";
          console.error("grip: download failed:", downloadMessage);
          notify("Could not save image — download failed");
        }
        return;
      }
    } else {
      let fetchedImage: FetchedImage;
      try {
        fetchedImage = await fetchImage(imageUrl, targetFormat);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        console.error("grip: fetch failed:", imageUrl, errorMessage);
        try {
          await browser.downloads.download(buildOriginalDownload({ imageUrl }));
          notify(`Saved in original format — could not convert to ${displayMap[targetFormat]}`);
        } catch (downloadErr) {
          const downloadMessage = downloadErr instanceof Error ? downloadErr.message : "Unknown error";
          console.error("grip: fallback failed:", downloadMessage);
          notify("Could not save image — the server may be blocking access");
        }
        return;
      }
      if (fetchedImage.kind === "download-original-url") {
        try {
          await browser.downloads.download(buildOriginalDownload({ imageUrl }));
        } catch (downloadErr) {
          const downloadMessage = downloadErr instanceof Error ? downloadErr.message : "Unknown error";
          console.error("grip: download failed:", downloadMessage);
          notify("Could not save image — download failed");
        }
        return;
      }
      if (import.meta.env.MANIFEST_VERSION === 2 && fetchedImage.kind === "download-original-blob") {
        try {
          await downloadBlob(fetchedImage.blob, fetchedImage.filename);
        } catch (downloadErr) {
          const downloadMessage = downloadErr instanceof Error ? downloadErr.message : "Unknown error";
          console.error("grip: download failed:", downloadMessage);
          notify("Could not save image — download failed");
        }
        return;
      }
      if (fetchedImage.kind !== "convert") {
        console.error("grip: unexpected download path:", fetchedImage.kind);
        notify("Could not save image — download failed");
        return;
      }
      dataUrl = fetchedImage.dataUrl;
    }

    let response: ConvertResponse | undefined;
    try {
      response = await convertDataUrl(dataUrl, imageUrl, targetFormat);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error("grip:", errorMessage);
      notify(errorMessage === "Conversion timeout" ? "Conversion timed out" : "Could not save image — conversion setup failed");
      return;
    }

    if (!response || !response.ok) {
      console.error("grip: conversion failed:", response?.error || "unknown");
      try {
        await browser.downloads.download(buildOriginalDownload({ imageUrl }));
        notify(`Saved in original format — conversion to ${displayMap[targetFormat]} failed`);
      } catch (downloadErr) {
        const downloadMessage = downloadErr instanceof Error ? downloadErr.message : "Unknown error";
        console.error("grip: fallback failed:", downloadMessage);
        notify("Could not save image — conversion error");
      }
      return;
    }

    try {
      await downloadDataUrl(response.dataUrl, response.filename);
    } catch (downloadErr) {
      const downloadMessage = downloadErr instanceof Error ? downloadErr.message : "Unknown error";
      console.error("grip: download failed:", downloadMessage);
      notify("Could not save image — download failed");
    }
  });
});
