/**
 * Shared extraction of Cityscope / ArcGIS-export style JSON used by map + legend.
 * Keep this module free of `cityscopeStyleResolver` imports/re-exports so resolvers can depend on it one-way.
 */

export type ParsedMarker = {
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

export type ParsedStroke = {
  color: string;
  width: number;
  opacity: number;
  dash: number[] | null;
};

export type ParsedFill = {
  color: string;
  opacity: number;
};

export type ParsedDefaultSymbol = {
  marker?: ParsedMarker;
  stroke?: ParsedStroke;
  fill?: ParsedFill;
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

/** Keeps only finite numbers (drops null, strings, NaN, Infinity). */
function finiteNumberArray(arr: unknown[]): number[] {
  const out: number[] = [];
  for (const x of arr) {
    if (typeof x === "number" && Number.isFinite(x)) out.push(x);
  }
  return out;
}

/**
 * Resolves CIM / Cityscope dash on a stroke symbol layer to a safe pattern or `null` (solid).
 * Accepts `dash` as number[], `{ array: number[] }`, or `dashArray`; invalid / empty → `null`.
 */
export function normalizedStrokeDashFromEntry(entry: Record<string, unknown>): number[] | null {
  const dashRaw = entry.dash;
  const dashArrayRaw = entry.dashArray;
  let raw: unknown[] | null = null;
  if (Array.isArray(dashRaw)) raw = dashRaw;
  else if (isRecord(dashRaw) && Array.isArray(dashRaw.array)) raw = dashRaw.array as unknown[];
  else if (Array.isArray(dashArrayRaw)) raw = dashArrayRaw;
  if (raw == null || raw.length === 0) return null;
  const cleaned = finiteNumberArray(raw);
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Reads `defaultSymbol.symbolLayers` from a pack style object (simple / uniqueValue default).
 */
export function parseDefaultSymbolFromStyle(style: unknown): ParsedDefaultSymbol | null {
  if (!isRecord(style)) return null;
  const def = style.defaultSymbol;
  if (!isRecord(def)) return null;
  const layersRaw = def.symbolLayers;
  if (!Array.isArray(layersRaw)) return null;

  const out: ParsedDefaultSymbol = {};
  for (const entry of layersRaw) {
    if (!isRecord(entry)) continue;
    const t = entry.type;
    if (t === "markerPoint" && isRecord(entry.marker)) {
      const m = entry.marker;
      const shape = str(m.shape, "circle");
      const iconUrlRaw = m.iconUrl;
      const iconUrl =
        typeof iconUrlRaw === "string" && iconUrlRaw.trim().length > 0 ? iconUrlRaw.trim() : undefined;
      const iconSize = numPair(m.iconSize);
      const iconAnchor = numPair(m.iconAnchor);
      out.marker = {
        shape,
        size: num(m.size, 8),
        fillColor: str(m.fillColor, "#3388ff"),
        strokeColor: str(m.strokeColor, "#000000"),
        strokeWidth: num(m.strokeWidth, 1),
      };
      if (iconUrl) {
        out.marker.iconUrl = iconUrl;
        if (iconSize) out.marker.iconSize = iconSize;
        if (iconAnchor) out.marker.iconAnchor = iconAnchor;
      }
    } else if (t === "stroke") {
      out.stroke = {
        color: str(entry.color, "#3388ff"),
        width: num(entry.width, 1),
        opacity: num(entry.opacity, 1),
        dash: normalizedStrokeDashFromEntry(entry),
      };
    } else if (t === "fill" && entry.fillType === "solid") {
      out.fill = {
        color: str(entry.color, "#808080"),
        opacity: num(entry.opacity, 0.7),
      };
    }
  }
  if (!out.marker && !out.stroke && !out.fill) return null;
  return out;
}

export function cityscopeGeometryKind(style: unknown): "point" | "line" | "polygon" | null {
  if (!isRecord(style)) return null;
  const t = style.type;
  if (t === "point" || t === "line" || t === "polygon") return t;
  return null;
}
