import { describe, expect, it, vi, beforeEach } from "vitest";

const { geoJSONMock } = vi.hoisted(() => ({
  geoJSONMock: vi.fn(),
}));

vi.mock("leaflet", () => ({
  default: {
    geoJSON: (...args: unknown[]) => geoJSONMock(...args),
  },
}));

import { loadGeoJsonLayer } from "./loadGeoJsonLayer";

describe("loadGeoJsonLayer", () => {
  beforeEach(() => {
    geoJSONMock.mockReset();
    geoJSONMock.mockReturnValue({
      addTo: vi.fn().mockReturnThis(),
    });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ type: "FeatureCollection", features: [] }),
    }) as unknown as typeof fetch;
  });

  it("creates non-interactive GeoJSON layers by default so map clicks reach the map", async () => {
    const map = { addTo: vi.fn() } as unknown as import("leaflet").Map;
    await loadGeoJsonLayer({
      map,
      urls: { geojsonUrl: "https://example.com/x.geojson" },
    });
    expect(geoJSONMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ interactive: false }),
    );
  });

  it("allows opt-in interactivity when explicitly requested", async () => {
    const map = { addTo: vi.fn() } as unknown as import("leaflet").Map;
    await loadGeoJsonLayer({
      map,
      urls: { geojsonUrl: "https://example.com/x.geojson" },
      geojsonInteractive: true,
    });
    expect(geoJSONMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ interactive: true }),
    );
  });
});
