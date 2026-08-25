import type { Settings } from "./settings";
import type { ConvertFormat } from "./types";

export interface MenuItem {
  id: string;
  title: string;
  parentId?: string;
}

const menuFormats: { format: ConvertFormat; id: string; title: string }[] = [
  { format: "png", id: "save-png", title: "Save as PNG" },
  { format: "jpeg", id: "save-jpg", title: "Save as JPG" },
  { format: "webp", id: "save-webp", title: "Save as WebP" },
];

export function menuItems(settings: Settings): MenuItem[] {
  const parentId = settings.defaultFormat ? undefined : "grip-parent";
  const visible = menuFormats.filter(({ format }) =>
    settings.defaultFormat ? format === settings.defaultFormat : settings.formats.includes(format),
  );

  const items: MenuItem[] = [];
  if (parentId) {
    items.push({ id: parentId, title: "Save Image As" });
  }
  for (const { id, title } of visible) {
    items.push(parentId ? { id, title, parentId } : { id, title });
  }
  if (settings.showOriginal) {
    items.push(parentId ? { id: "save-original", title: "Save Original", parentId } : { id: "save-original", title: "Save Original" });
  }
  return items;
}

export function formatForMenuItem(menuItemId: string | number): ConvertFormat | null {
  return menuFormats.find(({ id }) => id === menuItemId)?.format ?? null;
}
