import type { Feature } from "geojson";
import { resolvePopupFieldLabel } from "./popupFieldLabels";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type PopupField = string | { key: string; label?: string };

export type LayerPopupRow = { label: string; value: string };

export type LayerPopupPayload = {
  title?: string;
  rows: LayerPopupRow[];
  /**
   * Optional pre-escaped HTML for popup CTAs (Task 8). Injected inside `.layer-popup__actions`.
   * Omit or leave empty when no actions.
   */
  actionsHtml?: string;
};

export type BuildPopupPayloadArgs = {
  ui: unknown;
  properties: Record<string, unknown>;
};

type ParsedPopupUi = {
  fields: PopupField[];
  hideEmpty: boolean;
  titleField?: string;
};

function fieldKey(field: PopupField): string {
  return typeof field === "string" ? field : field.key;
}

function explicitFieldLabel(field: PopupField): string | undefined {
  if (typeof field === "string") return undefined;
  return field.label;
}

function parsePopupUi(ui: unknown): ParsedPopupUi | null {
  if (!ui || typeof ui !== "object") return null;
  const popup = (ui as { popup?: unknown }).popup;
  if (!popup || typeof popup !== "object") return null;
  const rawFields = (popup as { fields?: unknown }).fields;
  if (!Array.isArray(rawFields) || rawFields.length === 0) return null;

  const fields: PopupField[] = [];
  for (const entry of rawFields) {
    if (typeof entry === "string") {
      if (entry) fields.push(entry);
    } else if (entry && typeof entry === "object" && "key" in entry) {
      const key = String((entry as { key: unknown }).key ?? "").trim();
      if (key) fields.push(entry as { key: string; label?: string });
    }
  }
  if (!fields.length) return null;

  const titleRaw = (popup as { titleField?: unknown }).titleField;
  const titleField = typeof titleRaw === "string" && titleRaw.trim() ? titleRaw.trim() : undefined;

  return {
    fields,
    hideEmpty: Boolean((popup as { hideEmpty?: boolean }).hideEmpty),
    titleField,
  };
}

export function layerUiDeclaresPopupFields(ui: unknown): boolean {
  return parsePopupUi(ui) != null;
}

function isEmptyValue(raw: unknown, hideEmpty: boolean): boolean {
  if (raw === undefined || raw === null) return true;
  if (!hideEmpty) return false;
  if (typeof raw === "string") return raw.trim() === "";
  return false;
}

function formatCellValue(raw: unknown): string {
  if (raw === undefined || raw === null) return "";
  if (typeof raw === "object") {
    try {
      return JSON.stringify(raw);
    } catch {
      return String(raw);
    }
  }
  return String(raw);
}

/**
 * Shared popup payload for GeoJSON features and PMTiles debug-pick properties.
 *
 * Relevant-layer rule: `ui.popup.fields` must exist. The payload is non-null only when
 * a title (from `titleField`) or at least one field row has a visible value.
 */
export function buildLayerPopupPayload(args: BuildPopupPayloadArgs): LayerPopupPayload | null {
  const parsed = parsePopupUi(args.ui);
  if (!parsed) return null;

  const props = args.properties;
  let title: string | undefined;
  if (parsed.titleField) {
    const rawTitle = props[parsed.titleField];
    if (!isEmptyValue(rawTitle, true)) {
      const s = formatCellValue(rawTitle).trim();
      if (s) title = s;
    }
  }

  const rows: LayerPopupRow[] = [];
  for (const field of parsed.fields) {
    const key = fieldKey(field);
    if (!key) continue;
    if (parsed.titleField && key === parsed.titleField) continue;

    const raw = props[key];
    if (isEmptyValue(raw, parsed.hideEmpty)) continue;

    const label = resolvePopupFieldLabel(key, explicitFieldLabel(field));
    rows.push({ label, value: formatCellValue(raw) });
  }

  if (!title && rows.length === 0) return null;
  return { title, rows };
}

/** Hebrew CTA for layer popups: one action per current map mode. */
export function buildLayerPopupCtaButtonsHtml(mode: "pink" | "memorial" = "pink"): string {
  if (mode === "memorial") {
    return (
      `<button type="button" class="layer-popup__btn layer-popup__btn--memorial" data-layer-popup-cta="create_memorial">` +
      `${escapeHtml("הוסף אתר הנצחה כאן")}` +
      `</button>`
    );
  }
  return (
    `<button type="button" class="layer-popup__btn layer-popup__btn--pink" data-layer-popup-cta="create_pink_node">` +
    `${escapeHtml("הוסף נקודת ציר מורשת כאן")}` +
    `</button>`
  );
}

export function renderLayerPopupHtml(payload: LayerPopupPayload | null): string {
  if (!payload) return "";

  const titleHtml = payload.title
    ? `<div class="layer-popup__title">${escapeHtml(payload.title)}</div>`
    : "";

  const rowsHtml = payload.rows
    .map(
      (r) =>
        `<div class="layer-popup__row">` +
        `<span class="layer-popup__label">${escapeHtml(r.label)}</span>` +
        `<span class="layer-popup__value" dir="auto">${escapeHtml(r.value)}</span>` +
        `</div>`,
    )
    .join("");

  const actionsInner = payload.actionsHtml?.trim() ? payload.actionsHtml : "";
  const actionsHtml = `<div class="layer-popup__actions">${actionsInner}</div>`;

  return `<div class="layer-popup" dir="rtl" lang="he">${titleHtml}<div class="layer-popup__rows">${rowsHtml}</div>${actionsHtml}</div>`;
}

/** One picked feature entry from protomaps-leaflet `queryTileFeaturesDebug` values. */
export type PmtilesDebugPickEntry = {
  layerName: string;
  feature: { props: Record<string, unknown> };
};

/**
 * Chooses vector properties from a debug feature pick. Prefers MVT layer name matching `preferredLayerName`;
 * otherwise uses the last feature in the combined pick list (paint order approximation).
 */
export function pickPropertiesFromPmtilesDebugPick(
  pickedBySource: Map<string, PmtilesDebugPickEntry[]>,
  preferredLayerName: string,
): Record<string, unknown> | null {
  const flat: PmtilesDebugPickEntry[] = [];
  for (const arr of pickedBySource.values()) {
    flat.push(...arr);
  }
  if (!flat.length) return null;

  const exact = flat.filter((p) => p.layerName === preferredLayerName);
  const pool = exact.length > 0 ? exact : flat;
  const top = pool[pool.length - 1];
  return { ...top.feature.props };
}

export function featurePropertiesRecord(feature: Feature): Record<string, unknown> {
  const p = feature.properties;
  if (p && typeof p === "object" && !Array.isArray(p)) {
    return p as Record<string, unknown>;
  }
  return {};
}
