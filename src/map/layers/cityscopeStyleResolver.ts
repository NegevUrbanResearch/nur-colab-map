/** Resolves Cityscope-style layer JSON to concrete symbol parts per feature (simple / uniqueValue). */

import { normalizedStrokeDashFromEntry } from "./cityscopeSymbolParse";

export type ResolvedSymbolLayers = {
  fillLayer?: { color: string; opacity: number };
  strokeLayers: Array<{ color: string; width: number; opacity: number; dash?: number[] }>;
  markerPointLayer?: {
    shape: string;
    size: number;
    fillColor: string;
    strokeColor: string;
    strokeWidth: number;
    /** When set, GeoJSON point layers can render as `L.icon` + `L.marker` instead of a circle. */
    iconUrl?: string;
    iconSize?: [number, number];
    iconAnchor?: [number, number];
  };
  markerLineLayer?: { marker: Record<string, unknown>; placement: Record<string, unknown> };
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return x != null && typeof x === "object";
}

function num(x: unknown, fallback: number): number {
  return typeof x === "number" && Number.isFinite(x) ? x : fallback;
}

function str(x: unknown, fallback: string): string {
  return typeof x === "string" && x.length > 0 ? x : fallback;
}

function numPair(x: unknown): [number, number] | undefined {
  if (!Array.isArray(x) || x.length < 2) return undefined;
  const a = num(x[0], NaN);
  const b = num(x[1], NaN);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return undefined;
  return [a, b];
}

function getPropertyCaseInsensitive(properties: Record<string, unknown>, fieldName: string): unknown {
  const lower = fieldName.toLowerCase();
  for (const key of Object.keys(properties)) {
    if (key.toLowerCase() === lower) return properties[key];
  }
  return undefined;
}

function classValuesEqual(featureValue: unknown, classValue: unknown): boolean {
  if (featureValue === classValue) return true;
  if (featureValue == null && classValue == null) return true;
  return String(featureValue) === String(classValue);
}

export function pickClassSymbolOrDefault(style: unknown, properties: Record<string, unknown>): unknown {
  if (!isRecord(style)) return null;

  const renderer = style.renderer;
  const defaultSymbol = style.defaultSymbol;

  if (renderer === "uniqueValue") {
    const uv = style.uniqueValues;
    if (isRecord(uv)) {
      const fieldRaw = uv.field;
      const fieldName = typeof fieldRaw === "string" ? fieldRaw : null;
      const classes = uv.classes;
      if (fieldName && Array.isArray(classes)) {
        const propVal = getPropertyCaseInsensitive(properties, fieldName);
        for (const c of classes) {
          if (!isRecord(c)) continue;
          if (!classValuesEqual(propVal, c.value)) continue;
          const sym = c.symbol;
          if (isRecord(sym)) return sym;
        }
      }
    }
  }

  return defaultSymbol ?? null;
}

export function parseSymbolLayers(symbol: unknown): ResolvedSymbolLayers {
  const strokeLayers: ResolvedSymbolLayers["strokeLayers"] = [];
  let fillLayer: ResolvedSymbolLayers["fillLayer"];
  let markerPointLayer: ResolvedSymbolLayers["markerPointLayer"];
  let markerLineLayer: ResolvedSymbolLayers["markerLineLayer"];

  if (!isRecord(symbol)) {
    return { strokeLayers };
  }

  const layersRaw = symbol.symbolLayers;
  if (!Array.isArray(layersRaw)) {
    return { strokeLayers };
  }

  for (const entry of layersRaw) {
    if (!isRecord(entry)) continue;
    const t = entry.type;
    if (t === "markerPoint" && isRecord(entry.marker)) {
      const m = entry.marker;
      const iconUrlRaw = m.iconUrl;
      const iconUrl =
        typeof iconUrlRaw === "string" && iconUrlRaw.trim().length > 0 ? iconUrlRaw.trim() : undefined;
      const iconSize = numPair(m.iconSize);
      const iconAnchor = numPair(m.iconAnchor);
      const base = {
        shape: str(m.shape, "circle"),
        size: num(m.size, 8),
        fillColor: str(m.fillColor, "#3388ff"),
        strokeColor: str(m.strokeColor, "#000000"),
        strokeWidth: num(m.strokeWidth, 1),
      };
      markerPointLayer = iconUrl
        ? { ...base, iconUrl, ...(iconSize ? { iconSize } : {}), ...(iconAnchor ? { iconAnchor } : {}) }
        : base;
    } else if (t === "stroke") {
      const dashRaw = normalizedStrokeDashFromEntry(entry);
      const dash = dashRaw ?? undefined;
      const layer: (typeof strokeLayers)[number] = {
        color: str(entry.color, "#3388ff"),
        width: num(entry.width, 1),
        opacity: num(entry.opacity, 1),
      };
      if (dash) layer.dash = dash;
      strokeLayers.push(layer);
    } else if (t === "fill" && entry.fillType === "solid") {
      fillLayer = {
        color: str(entry.color, "#808080"),
        opacity: num(entry.opacity, 0.7),
      };
    } else if (t === "markerLine" && isRecord(entry.marker)) {
      const placement = isRecord(entry.placement) ? { ...entry.placement } : {};
      markerLineLayer = {
        marker: { ...entry.marker },
        placement,
      };
    }
  }

  const out: ResolvedSymbolLayers = { strokeLayers };
  if (fillLayer) out.fillLayer = fillLayer;
  if (markerPointLayer) out.markerPointLayer = markerPointLayer;
  if (markerLineLayer) out.markerLineLayer = markerLineLayer;
  return out;
}

export function resolveStyleForFeature(style: unknown, properties: Record<string, unknown>): ResolvedSymbolLayers {
  const symbol = pickClassSymbolOrDefault(style, properties);
  return parseSymbolLayers(symbol);
}
