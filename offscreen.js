chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type !== "convert") return;

    (async () => {
        const mimeType = `image/${message.format}`;

        try {
            const img = await new Promise((resolve, reject) => {
                const i = new Image();
                i.onload = () => resolve(i);
                i.onerror = () => reject(new Error("Failed to load image"));
                i.src = message.dataUrl;
            });

            if (img.naturalWidth * img.naturalHeight > 16000 * 16000) {
                throw new Error("Image too large for canvas conversion");
            }
            if (img.naturalWidth === 0 || img.naturalHeight === 0) {
                throw new Error("Image has zero dimensions");
            }

            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;

            const ctx = canvas.getContext("2d");
            if (!ctx) throw new Error("Failed to get canvas context");

            if (message.format === "jpeg") {
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
            ctx.drawImage(img, 0, 0);

            const quality = message.format === "jpeg" ? 0.95 : message.format === "webp" ? 0.9 : undefined;
            const convertedDataUrl = canvas.toDataURL(mimeType, quality);

            const ext = message.format === "jpeg" ? "jpg" : message.format;
            let filename;

            if (message.originalUrl.startsWith("data:")) {
                filename = `image.${ext}`;
            } else {
                try {
                    const parsed = new URL(message.originalUrl);
                    const segments = parsed.pathname.split("/").filter(Boolean);
                    const lastSegment = segments[segments.length - 1] || "";

                    if (!lastSegment) {
                        filename = `image.${ext}`;
                    } else {
                        let decodedSegment;
                        try {
                            decodedSegment = decodeURIComponent(lastSegment);
                        } catch {
                            decodedSegment = lastSegment;
                        }
                        const sanitizedSegment = decodedSegment.replace(/[/\\]/g, "").replace(/\.\./g, "");
                        const baseName = sanitizedSegment.replace(/\.[^.]+$/, "");
                        filename = baseName ? `${baseName}.${ext}` : `image.${ext}`;
                    }
                } catch {
                    filename = `image.${ext}`;
                }
            }

            sendResponse({ dataUrl: convertedDataUrl, filename });
        } catch (err) {
            sendResponse({ error: err.message });
        }
    })();

    return true;
});
