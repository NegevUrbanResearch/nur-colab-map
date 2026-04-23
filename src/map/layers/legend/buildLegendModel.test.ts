import { describe, expect, it } from "vitest";
import type { LayerRegistry } from "../types";
import { buildLegendModel } from "./buildLegendModel";

function key(packId: string, layerId: string): string {
  return `${packId}::${layerId}`;
}

describe("buildLegendModel", () => {
  it("groups legend entries by active pack", () => {
    const registry: LayerRegistry = {
      packs: [
        {
          id: "greens",
          name: "Greens Pack",
          displayName: "Greens Pack",
          manifest: {
            id: "greens",
            name: "Greens Pack",
            layers: [{ id: "g1", name: "Layer G1", file: "g1.geojson", format: "geojson", geometryType: "polygon" }],
          },
          styles: {},
        },
        {
          id: "future_development",
          name: "Future",
          displayName: "Future",
          manifest: {
            id: "future_development",
            name: "Future",
            layers: [{ id: "fd1", name: "Layer FD1", file: "fd1.geojson", format: "geojson", geometryType: "line" }],
          },
          styles: {},
        },
      ],
      getLayer: () => undefined,
    };
    const layerOnByKey: Record<string, boolean> = {
      [key("greens", "g1")]: true,
      [key("future_development", "fd1")]: true,
    };
    const model = buildLegendModel(registry, layerOnByKey);
    expect(model.groups.map((g) => g.packId)).toEqual(["greens", "future_development"]);
    expect(model.groups[0]?.rows.map((r) => r.label)).toEqual(["Layer G1"]);
    expect(model.groups[1]?.rows.map((r) => r.label)).toEqual(["Layer FD1"]);
  });

  it("merges october_7th geometry variants into one display family row", () => {
    const registry: LayerRegistry = {
      packs: [
        {
          id: "october_7th",
          name: "October 7Th",
          displayName: "October 7Th",
          manifest: {
            id: "october_7th",
            name: "October 7Th",
            layers: [
              {
                id: "חדירה_לישוב-אזור",
                name: "חדירה_לישוב-אזור",
                file: "a.geojson",
                format: "geojson",
                geometryType: "polygon",
              },
              {
                id: "חדירה_לישוב-נקודה",
                name: "חדירה_לישוב-נקודה",
                file: "b.geojson",
                format: "geojson",
                geometryType: "point",
              },
              {
                id: "ביזה-אזור",
                name: "ביזה-אזור",
                file: "c.geojson",
                format: "geojson",
                geometryType: "polygon",
              },
            ],
          },
          styles: {},
        },
      ],
      getLayer: () => undefined,
    };
    const layerOnByKey: Record<string, boolean> = {
      [key("october_7th", "חדירה_לישוב-אזור")]: true,
      [key("october_7th", "חדירה_לישוב-נקודה")]: true,
      [key("october_7th", "ביזה-אזור")]: false,
    };
    const model = buildLegendModel(registry, layerOnByKey);
    expect(model.groups).toHaveLength(1);
    expect(model.groups[0]?.packId).toBe("october_7th");
    expect(model.groups[0]?.rows).toEqual([{ id: "october_7th::family:חדירה_לישוב", label: "חדירה לישוב" }]);
  });

  it("uses point style for October 7 merged family swatch when point and area are both active", () => {
    const pointStyle = {
      type: "point",
      renderer: "simple",
      defaultSymbol: {
        symbolLayers: [
          {
            type: "markerPoint",
            marker: {
              shape: "circle",
              size: 8,
              fillColor: "#0d47a1",
              strokeColor: "#000000",
              strokeWidth: 1,
            },
          },
        ],
      },
    };
    const polygonStyle = {
      type: "polygon",
      defaultSymbol: {
        symbolLayers: [
          { type: "fill", fillType: "solid", color: "#d76e89", opacity: 0.8 },
          { type: "stroke", color: "#000000", width: 1, opacity: 1, dash: null },
        ],
      },
    };
    const registry: LayerRegistry = {
      packs: [
        {
          id: "october_7th",
          name: "October 7Th",
          displayName: "October 7Th",
          manifest: {
            id: "october_7th",
            name: "October 7Th",
            layers: [
              {
                id: "חדירה_לישוב-אזור",
                name: "חדירה_לישוב-אזור",
                file: "a.geojson",
                format: "geojson",
                geometryType: "polygon",
              },
              {
                id: "חדירה_לישוב-נקודה",
                name: "חדירה_לישוב-נקודה",
                file: "b.geojson",
                format: "geojson",
                geometryType: "point",
              },
            ],
          },
          styles: {
            "חדירה_לישוב-אזור": polygonStyle,
            "חדירה_לישוב-נקודה": pointStyle,
          },
        },
      ],
      getLayer: () => undefined,
    };
    const layerOnByKey: Record<string, boolean> = {
      [key("october_7th", "חדירה_לישוב-אזור")]: true,
      [key("october_7th", "חדירה_לישוב-נקודה")]: true,
    };
    const model = buildLegendModel(registry, layerOnByKey);
    const row = model.groups[0]?.rows[0];
    expect(row?.swatch?.kind).toBe("point");
    expect(row?.swatch?.fillColor).toBe("#0d47a1");
    expect(row?.swatches?.map((s) => s.kind)).toEqual(["point", "polygon"]);
  });

  it("emits deduped point, line, and polygon swatches for October 7 merged family when all variants are active", () => {
    const pointStyle = {
      type: "point",
      renderer: "simple",
      defaultSymbol: {
        symbolLayers: [
          {
            type: "markerPoint",
            marker: {
              shape: "circle",
              size: 8,
              fillColor: "#0d47a1",
              strokeColor: "#000000",
              strokeWidth: 1,
            },
          },
        ],
      },
    };
    const lineStyle = {
      type: "line",
      defaultSymbol: {
        symbolLayers: [{ type: "stroke", color: "#ff9800", width: 2, opacity: 1, dash: null }],
      },
    };
    const polygonStyle = {
      type: "polygon",
      defaultSymbol: {
        symbolLayers: [
          { type: "fill", fillType: "solid", color: "#d76e89", opacity: 0.8 },
          { type: "stroke", color: "#000000", width: 1, opacity: 1, dash: null },
        ],
      },
    };
    const registry: LayerRegistry = {
      packs: [
        {
          id: "october_7th",
          name: "October 7Th",
          displayName: "October 7Th",
          manifest: {
            id: "october_7th",
            name: "October 7Th",
            layers: [
              {
                id: "חדירה_לישוב-אזור",
                name: "חדירה_לישוב-אזור",
                file: "a.geojson",
                format: "geojson",
                geometryType: "polygon",
              },
              {
                id: "חדירה_לישוב-נקודה",
                name: "חדירה_לישוב-נקודה",
                file: "b.geojson",
                format: "geojson",
                geometryType: "point",
              },
              {
                id: "חדירה_לישוב-ציר",
                name: "חדירה_לישוב-ציר",
                file: "c.geojson",
                format: "geojson",
                geometryType: "line",
              },
            ],
          },
          styles: {
            "חדירה_לישוב-אזור": polygonStyle,
            "חדירה_לישוב-נקודה": pointStyle,
            "חדירה_לישוב-ציר": lineStyle,
          },
        },
      ],
      getLayer: () => undefined,
    };
    const layerOnByKey: Record<string, boolean> = {
      [key("october_7th", "חדירה_לישוב-אזור")]: true,
      [key("october_7th", "חדירה_לישוב-נקודה")]: true,
      [key("october_7th", "חדירה_לישוב-ציר")]: true,
    };
    const model = buildLegendModel(registry, layerOnByKey);
    const row = model.groups[0]?.rows[0];
    expect(row?.swatches?.map((s) => s.kind)).toEqual(["point", "line", "polygon"]);
    expect(row?.swatch?.kind).toBe("point");
  });

  it("normalizes underscores in fallback layer names for non-October packs", () => {
    const registry: LayerRegistry = {
      packs: [
        {
          id: "greens",
          name: "Greens Pack",
          displayName: "Greens Pack",
          manifest: {
            id: "greens",
            name: "Greens Pack",
            layers: [
              {
                id: "layer_with_underscores",
                name: "layer_with_underscores",
                file: "x.geojson",
                format: "geojson",
                geometryType: "polygon",
              },
            ],
          },
          styles: {},
        },
      ],
      getLayer: () => undefined,
    };
    const layerOnByKey: Record<string, boolean> = {
      [key("greens", "layer_with_underscores")]: true,
    };
    const model = buildLegendModel(registry, layerOnByKey);
    expect(model.groups[0]?.rows[0]?.label).toBe("layer with underscores");
  });

  it("normalizes underscores for October 7 non-merged layer legend rows", () => {
    const registry: LayerRegistry = {
      packs: [
        {
          id: "october_7th",
          name: "October 7Th",
          displayName: "October 7Th",
          manifest: {
            id: "october_7th",
            name: "October 7Th",
            layers: [
              {
                id: "some_other_layer",
                name: "foo_bar_baz",
                file: "x.geojson",
                format: "geojson",
                geometryType: "polygon",
              },
            ],
          },
          styles: {},
        },
      ],
      getLayer: () => undefined,
    };
    const layerOnByKey: Record<string, boolean> = {
      [key("october_7th", "some_other_layer")]: true,
    };
    const model = buildLegendModel(registry, layerOnByKey);
    expect(model.groups[0]?.rows[0]?.label).toBe("foo bar baz");
  });

  it("attaches legend swatch from pack styles when present", () => {
    const lineStyle = {
      type: "line",
      defaultSymbol: {
        symbolLayers: [{ type: "stroke", color: "#00ff00", width: 3, opacity: 1, dash: null }],
      },
    };
    const registry: LayerRegistry = {
      packs: [
        {
          id: "greens",
          name: "Greens Pack",
          displayName: "Greens Pack",
          manifest: {
            id: "greens",
            name: "Greens Pack",
            layers: [
              { id: "g1", name: "Layer G1", file: "g1.geojson", format: "geojson", geometryType: "line" },
            ],
          },
          styles: { g1: lineStyle },
        },
      ],
      getLayer: () => undefined,
    };
    const layerOnByKey: Record<string, boolean> = {
      [key("greens", "g1")]: true,
    };
    const model = buildLegendModel(registry, layerOnByKey);
    expect(model.groups[0]?.rows[0]?.swatch?.kind).toBe("line");
    expect(model.groups[0]?.rows[0]?.swatch?.strokeColor).toBe("#00ff00");
  });

  it("expands uniqueValue styles into per-class legend entries with distinct swatches", () => {
    const uvStyle = {
      type: "polygon",
      renderer: "uniqueValue",
      uniqueValues: {
        field: "land_use",
        classes: [
          {
            value: "park",
            label: "פארק",
            symbol: {
              symbolLayers: [
                { type: "fill", fillType: "solid", color: "#228822", opacity: 0.7 },
                { type: "stroke", color: "#113311", width: 1, opacity: 1, dash: null },
              ],
            },
          },
          {
            value: "built",
            label: "בנוי",
            symbol: {
              symbolLayers: [
                { type: "fill", fillType: "solid", color: "#884422", opacity: 0.5 },
                { type: "stroke", color: "#221100", width: 2, opacity: 1, dash: null },
              ],
            },
          },
        ],
      },
      defaultSymbol: {
        symbolLayers: [
          { type: "fill", fillType: "solid", color: "#999999", opacity: 0.3 },
          { type: "stroke", color: "#000000", width: 1, opacity: 1, dash: null },
        ],
      },
    };
    const registry: LayerRegistry = {
      packs: [
        {
          id: "greens",
          name: "Greens Pack",
          displayName: "Greens Pack",
          manifest: {
            id: "greens",
            name: "Greens Pack",
            layers: [
              {
                id: "land_poly",
                name: "land_use_layer",
                file: "x.geojson",
                format: "geojson",
                geometryType: "polygon",
              },
            ],
          },
          styles: { land_poly: uvStyle },
        },
      ],
      getLayer: () => undefined,
    };
    const layerOnByKey: Record<string, boolean> = {
      [key("greens", "land_poly")]: true,
    };
    const model = buildLegendModel(registry, layerOnByKey);
    const row = model.groups[0]?.rows[0];
    expect(row?.label).toBe("land use layer");
    expect(row?.swatch).toBeUndefined();
    expect(row?.classEntries).toHaveLength(2);
    expect(row?.classEntries?.[0]?.label).toBe("פארק");
    expect(row?.classEntries?.[0]?.swatch?.kind).toBe("polygon");
    expect(row?.classEntries?.[0]?.swatch?.fillColor).toBe("#228822");
    expect(row?.classEntries?.[1]?.label).toBe("בנוי");
    expect(row?.classEntries?.[1]?.swatch?.fillColor).toBe("#884422");
  });
});
