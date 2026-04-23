import type { Feature } from "geojson";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type PopupUi = {
  popup?: {
    fields?: string[];
  };
};

/** HTML snippet for Leaflet `bindPopup`, from manifest `ui` and GeoJSON feature properties. */
export function popupContentFromUi(ui: unknown, feature: Feature): string {
  if (!ui || typeof ui !== "object") return "";
  const { popup } = ui as PopupUi;
  const fields = popup?.fields;
  if (!fields?.length) return "";

  const props = (feature.properties ?? {}) as Record<string, unknown>;
  const rows: string[] = [];
  for (const key of fields) {
    const raw = props[key];
    if (raw === undefined || raw === null) continue;
    rows.push(
      `<div><strong>${escapeHtml(key)}</strong>: ${escapeHtml(String(raw))}</div>`,
    );
  }
  if (!rows.length) return "";
  return `<div class="layer-popup">${rows.join("")}</div>`;
}
