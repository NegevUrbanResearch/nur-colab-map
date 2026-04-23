import { cityscopeGeometryKind, type ParsedDefaultSymbol, type ParsedStroke } from "../cityscopeSymbolParse";
import { resolveStyleForFeature, type ResolvedSymbolLayers } from "../cityscopeStyleResolver";
import { packLineStrokePaintFromParsed, packPolygonOutlineWidthFromParsed } from "../styleToLeaflet";
import type { LegendSwatchPreview } from "./legendTypes";

function isRecord(x: unknown): x is Record<string, unknown> {
  return x != null && typeof x === "object";
}

/**
 * Picks feature-like props so `resolveStyleForFeature` can resolve a class symbol for legend preview.
 * - `simple` / non-uniqueValue: `{}` (default symbol)
 * - `uniqueValue`: first class’s `{ [field]: value }` so the legend shows that class, not the default-only symbol
 */
export function firstUniqueValueClassPreviewProps(style: unknown): Record<string, unknown> {
  if (!isRecord(style)) return {};
  if (style.renderer !== "uniqueValue") return {};
  const uv = style.uniqueValues;
  if (!isRecord(uv)) return {};
  const fieldRaw = uv.field;
  const fieldName = typeof fieldRaw === "string" && fieldRaw.length > 0 ? fieldRaw : null;
  if (!fieldName) return {};
  const classes = uv.classes;
  if (!Array.isArray(classes) || classes.length === 0) return {};
  const first = classes[0];
  if (!isRecord(first) || !("value" in first)) return {};
  return { [fieldName]: first.value };
}

function strokeFromResolved(resolved: ResolvedSymbolLayers): ParsedStroke | undefined {
  const s = resolved.strokeLayers[0];
  if (!s) return undefined;
  return {
    color: s.color,
    width: s.width,
    opacity: s.opacity,
    dash: s.dash != null && s.dash.length > 0 ? s.dash : null,
  };
}

/** Maps resolver output to the same `ParsedDefaultSymbol` shape as `parseDefaultSymbolFromStyle`. */
function parsedDefaultFromResolved(resolved: ResolvedSymbolLayers): ParsedDefaultSymbol {
  const m = resolved.markerPointLayer;
  return {
    marker: m
      ? {
          shape: m.shape,
          size: m.size,
          fillColor: m.fillColor,
          strokeColor: m.strokeColor,
          strokeWidth: m.strokeWidth,
          ...(m.iconUrl ? { iconUrl: m.iconUrl, iconSize: m.iconSize, iconAnchor: m.iconAnchor } : {}),
        }
      : undefined,
    stroke: strokeFromResolved(resolved),
    fill: resolved.fillLayer
      ? { color: resolved.fillLayer.color, opacity: resolved.fillLayer.opacity }
      : undefined,
  };
}

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
 * For `uniqueValue` styles without `previewPropsOverride`, previews the first class symbol (class-selected), not `defaultSymbol` only.
 * Pass `previewPropsOverride` as `{ [field]: classValue }` to preview a specific class.
 */
export function legendSwatchFromStyle(
  style: unknown,
  manifestGeometryType: string,
  previewPropsOverride?: Record<string, unknown>,
): LegendSwatchPreview | undefined {
  const previewProps =
    previewPropsOverride !== undefined ? previewPropsOverride : firstUniqueValueClassPreviewProps(style);
  const resolved = resolveStyleForFeature(style, previewProps);
  const parsed = parsedDefaultFromResolved(resolved);
  return swatchFromParsed(parsed, manifestGeometryType, style);
}
