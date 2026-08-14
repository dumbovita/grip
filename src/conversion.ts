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

const reservedNames = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

const extensionMap: Record<string, string> = {
  jpeg: "jpg",
  pjpeg: "jpg",
  jfif: "jpg",
  png: "png",
  "x-png": "png",
  webp: "webp",
  gif: "gif",
  avif: "avif",
  "svg+xml": "svg",
  "x-icon": "ico",
  ico: "ico",
  bmp: "bmp",
  "x-ms-bmp": "bmp",
};

export async function convertImage(request: ConvertImageRequest): Promise<ConvertedImage> {
  const img = await loadImage(request.dataUrl);

  try {
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

    try {
      return {
        dataUrl: canvas.toDataURL(`image/${request.format}`, qualityFor(request.format)),
        filename: buildFilename(request.originalUrl, request.format),
      };
    } finally {
      canvas.width = 0;
      canvas.height = 0;
    }
  } finally {
    img.src = "";
  }
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

    const sanitized = decodedSegment
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
      .replace(/\.\.+/g, ".")
      .trim();

    let baseName = sanitized.replace(/\.[^.]+$/, "").trim().replace(/\.+$/, "");

    if (!baseName || reservedNames.test(baseName)) {
      return baseName ? `${baseName}_image.${ext}` : `image.${ext}`;
    }

    return `${baseName}.${ext}`;
  } catch {
    return `image.${ext}`;
  }
}

export function buildOriginalFilename(originalUrl: string): string | undefined {
  if (!originalUrl.startsWith("data:")) return undefined;

  const mime = originalUrl.split(";", 1)[0].split(":")[1] || "";
  const subType = (mime.split("/")[1] || "").toLowerCase().trim();
  const resolvedExt = extensionMap[subType] || subType;
  const cleanExt = resolvedExt.replace(/[^a-zA-Z0-9]/g, "");

  return cleanExt ? `image.${cleanExt}` : "image";
}

export function isSameImageFormat(mimeType: string, format: ConvertFormat): boolean {
  const normalized = mimeType.split(";", 1)[0].trim().toLowerCase();

  if (format === "jpeg") {
    return (
      normalized === "image/jpeg" ||
      normalized === "image/jpg" ||
      normalized === "image/pjpeg" ||
      normalized === "image/jfif"
    );
  }

  if (format === "png") {
    return normalized === "image/png" || normalized === "image/x-png";
  }

  return normalized === `image/${format}`;
}

export function sniffImageFormat(buffer: ArrayBuffer): ConvertFormat | null {
  if (buffer.byteLength < 12) return null;
  const bytes = new Uint8Array(buffer, 0, 12);

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg";
  }

  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "png";
  }

  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "webp";
  }

  return null;
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  if (typeof FileReader !== "undefined") {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error || new Error("Failed to read blob"));
      reader.readAsDataURL(blob);
    });
  }

  const buffer = await blob.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  return `data:${blob.type || "application/octet-stream"};base64,${base64}`;
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      image.onload = null;
      image.onerror = null;
      resolve(image);
    };
    image.onerror = () => {
      image.onload = null;
      image.onerror = null;
      reject(new Error("Failed to load image"));
    };
    image.src = dataUrl;
  });
}

function qualityFor(format: ConvertFormat): number | undefined {
  if (format === "jpeg") return 0.95;
  if (format === "webp") return 0.9;
  return undefined;
}


