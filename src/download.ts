import { buildOriginalFilename } from "./conversion.ts";

interface OriginalDownloadRequest {
  imageUrl: string;
}

interface OriginalDownload {
  url: string;
  filename?: string;
}

export function buildOriginalDownload(request: OriginalDownloadRequest): OriginalDownload {
  const filename = buildOriginalFilename(request.imageUrl);

  return {
    url: request.imageUrl,
    ...(filename && { filename }),
  };
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return await (await fetch(dataUrl)).blob();
}
