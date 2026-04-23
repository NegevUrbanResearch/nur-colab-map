import { LineSymbolizer, PolygonSymbolizer, type PaintRule } from "protomaps-leaflet";

export type StyleToLeafletOptions = {
  /** Must match a vector `layer` name inside the PMTiles archive. */
  dataLayer: string;
  geometryHint?: "line" | "polygon";
};

/**
 * Converts pack style JSON into Protomaps `PaintRule`s.
 * Full cityscope style mapping can extend this; defaults are valid placeholders.
 */
export function styleToLeaflet(style: unknown, options: StyleToLeafletOptions): PaintRule[] {
  void style;
  const { dataLayer, geometryHint = "polygon" } = options;

  if (geometryHint === "line") {
    return [
      {
        dataLayer,
        symbolizer: new LineSymbolizer({ color: "#3388ff", width: 2 }),
      },
    ];
  }

  return [
    {
      dataLayer,
      symbolizer: new PolygonSymbolizer({
        fill: "rgba(51, 136, 255, 0.35)",
        stroke: "#3388ff",
        width: 1,
        opacity: 0.35,
      }),
    },
  ];
}
