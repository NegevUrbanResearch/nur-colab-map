import { LineSymbolizer, PolygonSymbolizer, type PaintRule } from "protomaps-leaflet";
import { parseDefaultSymbolFromStyle } from "./cityscopeSymbolParse";

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
    const s = parsed?.stroke;
    return [
      {
        dataLayer,
        symbolizer: new LineSymbolizer({
          color: s?.color ?? "#3388ff",
          width: s?.width ?? 2,
          opacity: s?.opacity ?? 1,
          dash: s?.dash && s.dash.length > 0 ? s.dash : undefined,
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
        width: stroke ? Math.max(0.5, stroke.width) : 1,
      }),
    },
  ];
}
