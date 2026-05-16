import type { ConvertMessage, ConvertResponse } from "./types";
import { convertImage } from "./conversion";

browser.runtime.onMessage.addListener((message: ConvertMessage, _sender, sendResponse: (response: ConvertResponse) => void) => {
  if (message.type !== "convert") return;

  (async () => {
    try {
      sendResponse({ ok: true, ...(await convertImage(message)) });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      sendResponse({ ok: false, error: errorMessage });
    }
  })();

  return true;
});
