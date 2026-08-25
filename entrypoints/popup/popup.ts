import { loadSettings, saveSettings, type Settings } from "../../src/settings";
import type { ConvertFormat } from "../../src/types";

const defaultFormatSelect = document.getElementById("default-format") as HTMLSelectElement;
const jpegQualityInput = document.getElementById("jpeg-quality") as HTMLInputElement;
const jpegQualityValue = document.getElementById("jpeg-quality-value") as HTMLOutputElement;
const webpQualityInput = document.getElementById("webp-quality") as HTMLInputElement;
const webpQualityValue = document.getElementById("webp-quality-value") as HTMLOutputElement;
const feedbackSelect = document.getElementById("feedback") as HTMLSelectElement;
const openSettingsButton = document.getElementById("open-settings") as HTMLButtonElement;

function render(settings: Settings): void {
  defaultFormatSelect.value = settings.defaultFormat ?? "";
  jpegQualityInput.value = String(settings.jpegQuality);
  jpegQualityValue.textContent = String(settings.jpegQuality);
  webpQualityInput.value = String(settings.webpQuality);
  webpQualityValue.textContent = String(settings.webpQuality);
  feedbackSelect.value = settings.feedback;
}

async function persist(patch: Partial<Settings>): Promise<void> {
  const settings = await loadSettings();
  render(saveSettings({ ...settings, ...patch }));
}

defaultFormatSelect.addEventListener("change", () =>
  persist({ defaultFormat: (defaultFormatSelect.value || null) as ConvertFormat | null }),
);

jpegQualityInput.addEventListener("input", () => {
  jpegQualityValue.textContent = jpegQualityInput.value;
});
jpegQualityInput.addEventListener("change", () => persist({ jpegQuality: Number(jpegQualityInput.value) }));

webpQualityInput.addEventListener("input", () => {
  webpQualityValue.textContent = webpQualityInput.value;
});
webpQualityInput.addEventListener("change", () => persist({ webpQuality: Number(webpQualityInput.value) }));

feedbackSelect.addEventListener("change", () => persist({ feedback: feedbackSelect.value as Settings["feedback"] }));

openSettingsButton.addEventListener("click", () => browser.runtime.openOptionsPage());

loadSettings().then(render);
