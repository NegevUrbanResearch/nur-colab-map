import type Point from "@mapbox/point-geometry";
import type { Feature, PaintRule, PaintSymbolizer } from "protomaps-leaflet";
import { buildOrderedDrawCommandsForSymbol, mergeFeatureProperties } from "./advancedStyleEngine";
import { executeAdvancedDrawCommands } from "./advancedStyleDrawing";
import { parseSymbolLayers, pickClassSymbolOrDefault } from "./cityscopeStyleResolver";

class AdvancedCityscopeSymbolizer implements PaintSymbolizer {
  constructor(
    private readonly packStyle: unknown,
    private readonly geometryHint: "line" | "polygon",
  ) {}

  draw(ctx: CanvasRenderingContext2D, geom: Point[][], _z: number, feature: Feature): void {
    const merged = mergeFeatureProperties(feature);
    const symbol = pickClassSymbolOrDefault(this.packStyle, merged);
    const resolved = parseSymbolLayers(symbol);
    if (!resolved.strokeLayers.length && !resolved.fillLayer && !resolved.markerLineLayer) {
      return;
    }
    const commands = buildOrderedDrawCommandsForSymbol(symbol, this.geometryHint);
    executeAdvancedDrawCommands(ctx, geom, commands, this.geometryHint);
  }
}

export type AdvancedPmtilesLayerOptions = {
  style: unknown;
  dataLayer: string;
  geometryHint: "line" | "polygon";
};

/**
 * Paint rules for PMTiles when Cityscope-style symbols need per-feature resolution
 * (uniqueValue, multi-stroke, dashed strokes, marker lines).
 */
export function createAdvancedPmtilesLayer(options: AdvancedPmtilesLayerOptions): { paintRules: PaintRule[] } {
  const symbolizer = new AdvancedCityscopeSymbolizer(options.style, options.geometryHint);
  return {
    paintRules: [{ dataLayer: options.dataLayer, symbolizer }],
  };
}
