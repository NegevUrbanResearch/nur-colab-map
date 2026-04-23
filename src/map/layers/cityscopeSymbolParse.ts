/** Shared extraction of Cityscope / ArcGIS-export style JSON used by map + legend. */

export type ParsedMarker = {
  shape: string;
  size: number;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
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
      out.marker = {
        shape: str(m.shape, "circle"),
        size: num(m.size, 8),
        fillColor: str(m.fillColor, "#3388ff"),
        strokeColor: str(m.strokeColor, "#000000"),
        strokeWidth: num(m.strokeWidth, 1),
      };
    } else if (t === "stroke") {
      out.stroke = {
        color: str(entry.color, "#3388ff"),
        width: num(entry.width, 1),
        opacity: num(entry.opacity, 1),
        dash: Array.isArray(entry.dash) ? (entry.dash as number[]) : entry.dash === null ? null : null,
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
