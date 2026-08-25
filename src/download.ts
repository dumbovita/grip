import { buildOriginalFilename } from "./conversion.ts";

interface OriginalDownloadRequest {
  imageUrl: string;
  subfolder: string;
}

interface OriginalDownload {
  url: string;
  filename?: string;
}

export function buildOriginalDownload(request: OriginalDownloadRequest): OriginalDownload {
  const filename = buildOriginalFilename(request.imageUrl);

  return {
    url: request.imageUrl,
    ...(filename && { filename: withSubfolder(filename, request.subfolder) }),
  };
}

export function withSubfolder(filename: string, subfolder: string): string {
  return subfolder ? `${subfolder}/${filename}` : filename;
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return await (await fetch(dataUrl)).blob();
}
