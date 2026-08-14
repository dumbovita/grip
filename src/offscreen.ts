import type { ConvertMessage, ConvertResponse } from "./types";
import { convertImage } from "./conversion";

browser.runtime.onMessage.addListener((message: unknown, _sender, sendResponse: (response: ConvertResponse) => void) => {
  if (!message || typeof message !== "object" || (message as ConvertMessage).type !== "convert") {
    return;
  }

  const convertMsg = message as ConvertMessage;
  (async () => {
    try {
      sendResponse({ ok: true, ...(await convertImage(convertMsg)) });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      sendResponse({ ok: false, error: errorMessage });
    }
  })();

  return true;
});

