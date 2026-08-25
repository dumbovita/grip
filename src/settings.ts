import type { ConvertFormat } from "./types";

type ConflictAction = "uniquify" | "overwrite" | "prompt";
type Feedback = "all" | "failures" | "off";

export interface Settings {
  defaultFormat: ConvertFormat | null;
  formats: ConvertFormat[];
  jpegQuality: number;
  webpQuality: number;
  jpegBackground: string;
  conflictAction: ConflictAction;
  subfolder: string;
  showOriginal: boolean;
  feedback: Feedback;
}

export const defaultSettings: Settings = {
  defaultFormat: null,
  formats: ["png", "jpeg", "webp"],
  jpegQuality: 95,
  webpQuality: 90,
  jpegBackground: "#ffffff",
  conflictAction: "uniquify",
  subfolder: "",
  showOriginal: true,
  feedback: "failures",
};

export async function loadSettings(): Promise<Settings> {
  const stored = await browser.storage.sync.get<Settings>(defaultSettings);
  return { ...defaultSettings, ...stored };
}

export function saveSettings(settings: Settings): Settings {
  const cleaned = { ...settings, subfolder: sanitizeSubfolder(settings.subfolder) };
  void browser.storage.sync.set(cleaned);
  return cleaned;
}

export function sanitizeSubfolder(subfolder: string): string {
  return subfolder
    .split(/[\\/]+/)
    .map((part) => part.replace(/[<>:"|?*\x00-\x1F]/g, "").trim())
    .filter((part) => part.length > 0 && part !== "." && part !== "..")
    .join("/");
}
