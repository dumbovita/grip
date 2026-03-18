let offscreenPending = null;

function notify(message) {
    chrome.notifications.create(`grip-${Date.now()}`, {
        type: "basic",
        iconUrl: "icons/icon48.png",
        title: "grip",
        message,
    });
}

async function ensureOffscreenDocument() {
    if (await chrome.offscreen.hasDocument()) return;

    offscreenPending ??= chrome.offscreen
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
        await chrome.offscreen.closeDocument();
    } catch {}
}

const formatMap = { "save-png": "png", "save-jpg": "jpeg", "save-webp": "webp" };
const displayMap = { png: "PNG", jpeg: "JPG", webp: "WebP" };

async function fetchImageAsDataUrl(url) {
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const blob = await response.blob();

    if (blob.size > 47 * 1024 * 1024) {
        throw new Error("Image exceeds 47MB limit");
    }

    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const chunks = [];
    for (let i = 0; i < bytes.length; i += 8192) {
        chunks.push(String.fromCharCode(...bytes.subarray(i, i + 8192)));
    }
    return "data:" + (blob.type || "application/octet-stream") + ";base64," + btoa(chunks.join(""));
}

chrome.runtime.onInstalled.addListener(async () => {
    await chrome.contextMenus.removeAll();

    await chrome.contextMenus.create({ id: "grip-parent", title: "Save Image As", contexts: ["image"] });

    await chrome.contextMenus.create({
        id: "save-png",
        parentId: "grip-parent",
        title: "Save as PNG",
        contexts: ["image"],
    });

    await chrome.contextMenus.create({
        id: "save-jpg",
        parentId: "grip-parent",
        title: "Save as JPG",
        contexts: ["image"],
    });

    await chrome.contextMenus.create({
        id: "save-webp",
        parentId: "grip-parent",
        title: "Save as WebP",
        contexts: ["image"],
    });
});

chrome.contextMenus.onClicked.addListener(async (info) => {
    const targetFormat = formatMap[info.menuItemId];
    if (!targetFormat) return;

    const imageUrl = info.srcUrl;
    const pageUrl = info.pageUrl;

    let dataUrl;
    const isDataUrl = imageUrl.startsWith("data:");

    if (isDataUrl) {
        dataUrl = imageUrl;
    } else {
        try {
            dataUrl = await fetchImageAsDataUrl(imageUrl);
        } catch (err) {
            console.error("grip: fetch failed:", imageUrl, err.message);
            try {
                await chrome.downloads.download({
                    url: imageUrl,
                    ...(pageUrl && { headers: [{ name: "Referer", value: pageUrl }] }),
                });
                notify(`Saved in original format — could not convert to ${displayMap[targetFormat]}`);
            } catch (downloadErr) {
                console.error("grip: fallback failed:", downloadErr.message);
                notify("Could not save image — the server may be blocking access");
            }
            return;
        }
    }

    await ensureOffscreenDocument();

    try {
        let response;
        try {
            response = await Promise.race([
                chrome.runtime.sendMessage({ type: "convert", dataUrl, originalUrl: imageUrl, format: targetFormat }),
                new Promise((_, reject) => setTimeout(() => reject(new Error("Conversion timeout")), 30000)),
            ]);
        } catch (timeoutErr) {
            console.error("grip:", timeoutErr.message);
            notify("Conversion timed out");
            return;
        }

        if (!response || response.error) {
            console.error("grip: conversion failed:", response?.error || "unknown");
            let fallbackFilename = "image";
            if (isDataUrl) {
                const mime = imageUrl.split(";")[0].split(":")[1] || "";
                const ext = mime.split("/")[1] || "";
                const safeExt = { jpeg: "jpg", png: "png", webp: "webp", gif: "gif" }[ext] || ext;
                if (safeExt) fallbackFilename = `image.${safeExt}`;
            }
            try {
                await chrome.downloads.download({
                    url: imageUrl,
                    ...(isDataUrl && { filename: fallbackFilename }),
                    ...(!isDataUrl && pageUrl && { headers: [{ name: "Referer", value: pageUrl }] }),
                });
                notify(`Saved in original format — conversion to ${displayMap[targetFormat]} failed`);
            } catch (downloadErr) {
                console.error("grip: fallback failed:", downloadErr.message);
                notify("Could not save image — conversion error");
            }
            return;
        }

        try {
            await chrome.downloads.download({ url: response.dataUrl, filename: response.filename });
        } catch (downloadErr) {
            console.error("grip: download failed:", downloadErr.message);
            notify("Could not save image — download failed");
        }
    } finally {
        await closeOffscreenDocument();
    }
});
