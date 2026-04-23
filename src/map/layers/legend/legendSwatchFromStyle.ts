import {
  cityscopeGeometryKind,
  parseDefaultSymbolFromStyle,
  type ParsedDefaultSymbol,
} from "../cityscopeSymbolParse";
import { packLineStrokePaintFromParsed, packPolygonOutlineWidthFromParsed } from "../styleToLeaflet";
import type { LegendSwatchPreview } from "./legendTypes";

function normalizePointShape(raw: string): LegendSwatchPreview["pointShape"] {
  const s = raw.toLowerCase();
  if (s === "square" || s === "diamond" || s === "cross" || s === "x") return s;
  return "circle";
}

function swatchFromParsed(
  parsed: ParsedDefaultSymbol,
  geometryType: string,
  styleObj: unknown,
): LegendSwatchPreview | undefined {
  const g = geometryType.toLowerCase();
  const styleKind = cityscopeGeometryKind(styleObj);

  if (g === "point" || styleKind === "point") {
    const m = parsed.marker;
    if (!m) return undefined;
    return {
      kind: "point",
      fillColor: m.fillColor,
      strokeColor: m.strokeColor,
      strokeWidth: m.strokeWidth,
      strokeOpacity: 1,
      fillOpacity: 1,
      pointShape: normalizePointShape(m.shape),
      pointSizePx: Math.max(6, Math.min(14, m.size)),
    };
  }

  if (g === "line" || styleKind === "line") {
    const s = parsed.stroke;
    if (!s) return undefined;
    const paint = packLineStrokePaintFromParsed(s, { color: "#3388ff", weight: 2, opacity: 1 });
    return {
      kind: "line",
      strokeColor: paint.color,
      strokeWidth: paint.weight,
      strokeOpacity: paint.opacity,
      ...(paint.dash ? { strokeDasharray: paint.dash.join(" ") } : {}),
    };
  }

  const fill = parsed.fill;
  const stroke = parsed.stroke;
  if (!fill && !stroke) return undefined;
  return {
    kind: "polygon",
    fillColor: fill?.color,
    fillOpacity: fill?.opacity,
    strokeColor: stroke?.color,
    strokeWidth: stroke ? packPolygonOutlineWidthFromParsed(stroke) : undefined,
    strokeOpacity: stroke?.opacity,
  };
}

/**
 * Builds a small legend preview from pack `styles.json` entry and manifest geometry.
 */
export function legendSwatchFromStyle(style: unknown, manifestGeometryType: string): LegendSwatchPreview | undefined {
  const parsed = parseDefaultSymbolFromStyle(style);
  if (!parsed) return undefined;
  return swatchFromParsed(parsed, manifestGeometryType, style);
}
