export type ConvertFormat = "png" | "jpeg" | "webp";

export interface ConvertMessage {
  type: "convert";
  dataUrl: string;
  originalUrl: string;
  format: ConvertFormat;
}

export type ConvertResponse =
  | { ok: true; dataUrl: string; filename: string }
  | { ok: false; error: string };
