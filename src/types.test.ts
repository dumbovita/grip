import type { ConvertResponse } from "./types";

const success: ConvertResponse = { ok: true, dataUrl: "data:image/png;base64,abc", filename: "image.png" };
const failure: ConvertResponse = { ok: false, error: "Failed to load image" };

// @ts-expect-error success responses must include converted data.
const missingDataUrl: ConvertResponse = { ok: true, filename: "image.png" };

// @ts-expect-error failure responses must include an error.
const missingError: ConvertResponse = { ok: false };

void success;
void failure;
void missingDataUrl;
void missingError;
