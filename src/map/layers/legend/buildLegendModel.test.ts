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
});
