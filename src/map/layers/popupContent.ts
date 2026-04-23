import type { Feature } from "geojson";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type PopupField = string | { key: string; label?: string };

type PopupUi = {
  popup?: {
    fields?: PopupField[];
  };
};

function fieldKey(field: PopupField): string {
  return typeof field === "string" ? field : field.key;
}

function fieldLabel(field: PopupField): string {
  if (typeof field === "string") return field;
  return field.label?.trim() ? field.label : field.key;
}

/** HTML snippet for Leaflet `bindPopup`, from manifest `ui` and GeoJSON feature properties. */
export function popupContentFromUi(ui: unknown, feature: Feature): string {
  if (!ui || typeof ui !== "object") return "";
  const { popup } = ui as PopupUi;
  const fields = popup?.fields;
  if (!fields?.length) return "";

  const props = (feature.properties ?? {}) as Record<string, unknown>;
  const rows: string[] = [];
  for (const field of fields) {
    const key = fieldKey(field);
    if (!key) continue;
    const raw = props[key];
    if (raw === undefined || raw === null) continue;
    const label = fieldLabel(field);
    rows.push(`<div><strong>${escapeHtml(label)}</strong>: ${escapeHtml(String(raw))}</div>`);
  }
  if (!rows.length) return "";
  return `<div class="layer-popup">${rows.join("")}</div>`;
}
