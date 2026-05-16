import { defineConfig } from "wxt";

export default defineConfig({
  zip: {
    excludeSources: ["test/**"],
  },
  manifest: ({ browser, manifestVersion }) => ({
    version: "2.0.0",
    name: "grip",
    description: "Get Right-click Images Properly: save images as PNG, JPG, or WebP.",
    permissions: [
      "contextMenus",
      "downloads",
      "notifications",
      ...(manifestVersion === 3 ? ["offscreen"] : []),
    ],
    host_permissions: ["*://*/*"],
    icons: {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png",
    },
    ...(browser === "firefox" && {
      browser_specific_settings: {
        gecko: {
          data_collection_permissions: {
            required: ["none"],
          },
        },
      },
    }),
  }),
});
