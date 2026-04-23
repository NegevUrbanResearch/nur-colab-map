import { describe, expect, it } from "vitest";
import { layerDataBasename, layerManifestEntryIsResolvable } from "./layerAssetResolution";

describe("layerManifestEntryIsResolvable", () => {
  it("accepts layer when GeoJSON basename exists", () => {
    const layer = {
      id: "a",
      name: "a",
      file: "data.geojson",
      format: "geojson",
      geometryType: "polygon" as const,
    };
    expect(layerManifestEntryIsResolvable(layer, new Set(["data.geojson"]))).toBe(true);
  });

  it("accepts PMTiles-only when pmtiles exists and GeoJSON is absent (PMTiles-first)", () => {
    const layer = {
      id: "a",
      name: "a",
      file: "missing.geojson",
      format: "geojson",
      geometryType: "polygon" as const,
      pmtilesFile: "tiles.pmtiles",
    };
    expect(layerManifestEntryIsResolvable(layer, new Set(["tiles.pmtiles"]))).toBe(true);
  });

  it("rejects when neither file nor pmtiles basename is on disk", () => {
    const layer = {
      id: "a",
      name: "a",
      file: "a.geojson",
      format: "geojson",
      geometryType: "line" as const,
      pmtilesFile: "a.pmtiles",
    };
    expect(layerManifestEntryIsResolvable(layer, new Set(["other.pmtiles"]))).toBe(false);
  });

  it("normalizes manifest paths to basename for matching", () => {
    const layer = {
      id: "a",
      name: "a",
      file: "nested/x.geojson",
      format: "geojson",
      geometryType: "line" as const,
    };
    expect(layerDataBasename("nested/x.geojson")).toBe("x.geojson");
    expect(layerManifestEntryIsResolvable(layer, new Set(["x.geojson"]))).toBe(true);
  });
});
