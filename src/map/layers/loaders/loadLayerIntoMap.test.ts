import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Map as LeafletMap } from "leaflet";
import { loadLayerIntoMap } from "./loadLayerIntoMap";

vi.mock("./loadPmtilesLayer", () => ({
  loadPmtilesLayer: vi.fn(),
}));

vi.mock("./loadGeoJsonLayer", () => ({
  loadGeoJsonLayer: vi.fn(),
}));

import { loadPmtilesLayer } from "./loadPmtilesLayer";
import { loadGeoJsonLayer } from "./loadGeoJsonLayer";

describe("loadLayerIntoMap", () => {
  const mockMap = {} as LeafletMap;

  beforeEach(() => {
    vi.mocked(loadPmtilesLayer).mockReset();
    vi.mocked(loadGeoJsonLayer).mockReset();
  });

  it("uses pmtiles when available", async () => {
    vi.mocked(loadPmtilesLayer).mockResolvedValue({
      mode: "pmtiles",
      layer: {} as import("leaflet").Layer,
    });
    vi.mocked(loadGeoJsonLayer).mockResolvedValue({
      mode: "geojson",
      layer: {} as import("leaflet").Layer,
    });

    const result = await loadLayerIntoMap({
      map: mockMap,
      urls: {
        pmtilesUrl: "https://example.com/tiles.pmtiles",
        geojsonUrl: "https://example.com/data.geojson",
      },
    });

    expect(result.mode).toBe("pmtiles");
    expect(loadPmtilesLayer).toHaveBeenCalledTimes(1);
    expect(loadGeoJsonLayer).not.toHaveBeenCalled();
  });

  it("falls back to geojson when pmtiles fails", async () => {
    vi.mocked(loadPmtilesLayer).mockRejectedValue(new Error("pmtiles failed"));
    vi.mocked(loadGeoJsonLayer).mockResolvedValue({
      mode: "geojson",
      layer: {} as import("leaflet").Layer,
    });

    const result = await loadLayerIntoMap({
      map: mockMap,
      urls: {
        pmtilesUrl: "https://example.com/tiles.pmtiles",
        geojsonUrl: "https://example.com/data.geojson",
      },
    });

    expect(result.mode).toBe("geojson");
    expect(loadPmtilesLayer).toHaveBeenCalledTimes(1);
    expect(loadGeoJsonLayer).toHaveBeenCalledTimes(1);
    expect(loadGeoJsonLayer).toHaveBeenCalledWith(
      expect.objectContaining({ geojsonInteractive: false }),
    );
  });

  it("keeps GeoJSON interactive when PMTiles was not in use", async () => {
    vi.mocked(loadGeoJsonLayer).mockResolvedValue({
      mode: "geojson",
      layer: {} as import("leaflet").Layer,
    });

    await loadLayerIntoMap({
      map: mockMap,
      urls: { geojsonUrl: "https://example.com/data.geojson" },
    });

    expect(loadPmtilesLayer).not.toHaveBeenCalled();
    expect(loadGeoJsonLayer).toHaveBeenCalledWith(
      expect.not.objectContaining({ geojsonInteractive: false }),
    );
  });

  it("throws when pmtiles fails and no geojson url exists", async () => {
    vi.mocked(loadPmtilesLayer).mockRejectedValue(new Error("pmtiles failed"));
    await expect(
      loadLayerIntoMap({
        map: mockMap,
        urls: { pmtilesUrl: "https://example.com/tiles.pmtiles" },
      }),
    ).rejects.toThrow(/no geojsonUrl/);
    expect(loadGeoJsonLayer).not.toHaveBeenCalled();
  });
});
