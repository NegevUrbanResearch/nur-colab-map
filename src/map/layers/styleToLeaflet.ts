import { LineSymbolizer, PolygonSymbolizer, type PaintRule } from "protomaps-leaflet";
import { parseDefaultSymbolFromStyle, type ParsedStroke } from "./cityscopeSymbolParse";

const PACK_LINE_WEIGHT_MIN = 1;
const PACK_LINE_WEIGHT_MAX = 12;

/** Polygon outline width (PMTiles + GeoJSON + legend) — separate cap from line layers. */
const PACK_POLYGON_OUTLINE_MIN = 0.5;
const PACK_POLYGON_OUTLINE_MAX = 6;

/**
 * Pixel width for polygon outlines from pack stroke (or default hairline when no stroke symbol).
 * Shared by PMTiles `PolygonSymbolizer`, GeoJSON path `weight`, and legend swatch.
 */
export function packPolygonOutlineWidthFromParsed(stroke: ParsedStroke | undefined): number {
  if (!stroke) return 1;
  return Math.max(PACK_POLYGON_OUTLINE_MIN, Math.min(PACK_POLYGON_OUTLINE_MAX, stroke.width));
}

export type PackLineStrokePaint = {
  color: string;
  weight: number;
  opacity: number;
  /** Pixel dash pattern for Leaflet `dashArray` / Protomaps `LineSymbolizer.dash`; omit when solid. */
  dash: number[] | undefined;
};

/**
 * Normalizes a parsed pack stroke for line layers so PMTiles and GeoJSON paths share weight/opacity/dash parity.
 */
export function packLineStrokePaintFromParsed(
  stroke: ParsedStroke | undefined,
  defaults: { color: string; weight: number; opacity: number },
): PackLineStrokePaint {
  const weightRaw = stroke?.width ?? defaults.weight;
  const weight = Math.max(PACK_LINE_WEIGHT_MIN, Math.min(PACK_LINE_WEIGHT_MAX, weightRaw));
  const dash = stroke?.dash != null && stroke.dash.length > 0 ? stroke.dash : undefined;
  return {
    color: stroke?.color ?? defaults.color,
    weight,
    opacity: stroke?.opacity ?? defaults.opacity,
    dash,
  };
}

export type StyleToLeafletOptions = {
  /** Must match a vector `layer` name inside the PMTiles archive. */
  dataLayer: string;
  geometryHint?: "line" | "polygon";
};

/**
 * Converts pack style JSON into Protomaps `PaintRule`s (default / simple renderer).
 */
export function styleToLeaflet(style: unknown, options: StyleToLeafletOptions): PaintRule[] {
  const { dataLayer, geometryHint = "polygon" } = options;
  const parsed = parseDefaultSymbolFromStyle(style);

  if (geometryHint === "line") {
    const paint = packLineStrokePaintFromParsed(parsed?.stroke, {
      color: "#3388ff",
      weight: 2,
      opacity: 1,
    });
    return [
      {
        dataLayer,
        symbolizer: new LineSymbolizer({
          color: paint.color,
          width: paint.weight,
          opacity: paint.opacity,
          dash: paint.dash,
        }),
      },
    ];
  }

  const fill = parsed?.fill;
  const stroke = parsed?.stroke;
  return [
    {
      dataLayer,
      symbolizer: new PolygonSymbolizer({
        fill: fill?.color ?? "rgba(51, 136, 255, 0.35)",
        opacity: fill?.opacity ?? 0.35,
        stroke: stroke?.color ?? fill?.color ?? "#3388ff",
        width: packPolygonOutlineWidthFromParsed(stroke),
      }),
    },
  ];
}
