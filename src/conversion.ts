import type { ConvertFormat } from "./types";

export interface ConvertImageRequest {
  dataUrl: string;
  originalUrl: string;
  format: ConvertFormat;
}

export interface ConvertedImage {
  dataUrl: string;
  filename: string;
}

export async function convertImage(request: ConvertImageRequest): Promise<ConvertedImage> {
  const img = await loadImage(request.dataUrl);

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

  if (request.format === "jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(img, 0, 0);

  return {
    dataUrl: canvas.toDataURL(`image/${request.format}`, qualityFor(request.format)),
    filename: buildFilename(request.originalUrl, request.format),
  };
}

export function buildFilename(originalUrl: string, format: ConvertFormat): string {
  const ext = format === "jpeg" ? "jpg" : format;

  if (originalUrl.startsWith("data:")) {
    return `image.${ext}`;
  }

  try {
    const parsed = new URL(originalUrl);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const lastSegment = segments[segments.length - 1] || "";

    if (!lastSegment) {
      return `image.${ext}`;
    }

    let decodedSegment: string;
    try {
      decodedSegment = decodeURIComponent(lastSegment);
    } catch {
      decodedSegment = lastSegment;
    }

    const sanitizedSegment = decodedSegment.replace(/[/\\]/g, "").replace(/\.\./g, "");
    const baseName = sanitizedSegment.replace(/\.[^.]+$/, "");
    return baseName ? `${baseName}.${ext}` : `image.${ext}`;
  } catch {
    return `image.${ext}`;
  }
}

export function buildOriginalFilename(originalUrl: string): string | undefined {
  if (!originalUrl.startsWith("data:")) return undefined;

  const mime = originalUrl.split(";", 1)[0].split(":")[1] || "";
  const ext = mime.split("/")[1] || "";
  const safeExt: Record<string, string> = { jpeg: "jpg", png: "png", webp: "webp", gif: "gif" };
  const resolvedExt = safeExt[ext] || ext;

  return resolvedExt ? `image.${resolvedExt}` : "image";
}

export function isSameImageFormat(mimeType: string, format: ConvertFormat): boolean {
  const normalizedMime = mimeType.split(";", 1)[0].trim().toLowerCase();

  if (format === "jpeg") {
    return normalizedMime === "image/jpeg" || normalizedMime === "image/jpg";
  }

  return normalizedMime === `image/${format}`;
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image"));
    image.src = dataUrl;
  });
}

function qualityFor(format: ConvertFormat): number | undefined {
  if (format === "jpeg") return 0.95;
  if (format === "webp") return 0.9;
  return undefined;
}
