import { defaultSettings, loadSettings, saveSettings, type Settings } from "../../src/settings";
import type { ConvertFormat } from "../../src/types";

const defaultFormatSelect = document.getElementById("default-format") as HTMLSelectElement;
const formatChecks = Array.from(document.querySelectorAll<HTMLInputElement>('input[data-format]'));
const showOriginalCheck = document.getElementById("show-original") as HTMLInputElement;
const jpegQualityInput = document.getElementById("jpeg-quality") as HTMLInputElement;
const jpegQualityValue = document.getElementById("jpeg-quality-value") as HTMLOutputElement;
const webpQualityInput = document.getElementById("webp-quality") as HTMLInputElement;
const webpQualityValue = document.getElementById("webp-quality-value") as HTMLOutputElement;
const jpegBackgroundInput = document.getElementById("jpeg-background") as HTMLInputElement;
const jpegBackgroundValue = document.getElementById("jpeg-background-value") as HTMLOutputElement;
const subfolderInput = document.getElementById("subfolder") as HTMLInputElement;
const conflictActionSelect = document.getElementById("conflict-action") as HTMLSelectElement;
const conflictHint = document.getElementById("conflict-hint") as HTMLParagraphElement;
const feedbackSelect = document.getElementById("feedback") as HTMLSelectElement;

let current: Settings = defaultSettings;

function render(settings: Settings): void {
  current = settings;
  defaultFormatSelect.value = settings.defaultFormat ?? "";
  for (const check of formatChecks) {
    check.checked = settings.formats.includes(check.value as ConvertFormat);
  }
  showOriginalCheck.checked = settings.showOriginal;
  jpegQualityInput.value = String(settings.jpegQuality);
  jpegQualityValue.textContent = String(settings.jpegQuality);
  webpQualityInput.value = String(settings.webpQuality);
  webpQualityValue.textContent = String(settings.webpQuality);
  jpegBackgroundInput.value = settings.jpegBackground;
  jpegBackgroundValue.textContent = settings.jpegBackground;
  subfolderInput.value = settings.subfolder;
  conflictActionSelect.value = settings.conflictAction;
  feedbackSelect.value = settings.feedback;
}

function persist(patch: Partial<Settings>): void {
  render(saveSettings({ ...current, ...patch }));
}

defaultFormatSelect.addEventListener("change", () =>
  persist({ defaultFormat: (defaultFormatSelect.value || null) as ConvertFormat | null }),
);

for (const check of formatChecks) {
  check.addEventListener("change", () =>
    persist({ formats: formatChecks.filter((box) => box.checked).map((box) => box.value as ConvertFormat) }),
  );
}

showOriginalCheck.addEventListener("change", () => persist({ showOriginal: showOriginalCheck.checked }));

jpegQualityInput.addEventListener("input", () => {
  jpegQualityValue.textContent = jpegQualityInput.value;
});
jpegQualityInput.addEventListener("change", () => persist({ jpegQuality: Number(jpegQualityInput.value) }));

webpQualityInput.addEventListener("input", () => {
  webpQualityValue.textContent = webpQualityInput.value;
});
webpQualityInput.addEventListener("change", () => persist({ webpQuality: Number(webpQualityInput.value) }));

jpegBackgroundInput.addEventListener("input", () => {
  jpegBackgroundValue.textContent = jpegBackgroundInput.value;
});
jpegBackgroundInput.addEventListener("change", () => persist({ jpegBackground: jpegBackgroundInput.value }));

subfolderInput.addEventListener("change", () => {
  persist({ subfolder: subfolderInput.value });
  subfolderInput.value = current.subfolder;
});

if (navigator.userAgent.includes("Firefox")) {
  conflictActionSelect.disabled = true;
  conflictHint.hidden = false;
}
conflictActionSelect.addEventListener("change", () =>
  persist({ conflictAction: conflictActionSelect.value as Settings["conflictAction"] }),
);

feedbackSelect.addEventListener("change", () => persist({ feedback: feedbackSelect.value as Settings["feedback"] }));

browser.storage.onChanged.addListener(async () => {
  render(await loadSettings());
});

loadSettings().then(render);
