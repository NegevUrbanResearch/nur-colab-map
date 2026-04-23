import { describe, expect, it, vi, beforeEach } from "vitest";
import type { FeatureCollection } from "geojson";
import type { GeoJSONOptions } from "leaflet";

const { geoJSONMock, stopPropagationMock } = vi.hoisted(() => ({
  geoJSONMock: vi.fn(),
  stopPropagationMock: vi.fn(),
}));

vi.mock("leaflet", () => ({
  default: {
    geoJSON: (...args: unknown[]) => geoJSONMock(...args),
    DomEvent: {
      stopPropagation: (...a: unknown[]) => stopPropagationMock(...a),
    },
  },
}));

import { LAYER_POPUP_MAX_WIDTH_PX, LAYER_POPUP_MIN_WIDTH_PX } from "../popupLayout";
import { loadGeoJsonLayer } from "./loadGeoJsonLayer";

const sampleFeatureCollection: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "Spot" },
      geometry: { type: "Point", coordinates: [34, 31] },
    },
  ],
};

describe("loadGeoJsonLayer", () => {
  beforeEach(() => {
    stopPropagationMock.mockReset();
    geoJSONMock.mockReset();
    geoJSONMock.mockImplementation((data: FeatureCollection, options?: GeoJSONOptions) => {
      if (options?.onEachFeature && data.type === "FeatureCollection") {
        for (const feature of data.features) {
          const leafletFeature = {
            bindPopup: vi.fn(),
            on: vi.fn(),
          };
          options.onEachFeature(feature, leafletFeature as never);
        }
      }
      return {
        addTo: vi.fn().mockReturnThis(),
      };
    });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => sampleFeatureCollection,
    }) as unknown as typeof fetch;
  });

  it("creates non-interactive GeoJSON layers by default when no popup config exists", async () => {
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

  it("defaults to interactive when ui declares popup fields", async () => {
    const map = { addTo: vi.fn() } as unknown as import("leaflet").Map;
    await loadGeoJsonLayer({
      map,
      urls: { geojsonUrl: "https://example.com/x.geojson" },
      ui: { popup: { fields: [{ key: "name" }] } },
    });
    expect(geoJSONMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ interactive: true }),
    );
  });

  it("keeps explicit geojsonInteractive false even when ui declares popup fields", async () => {
    const map = { addTo: vi.fn() } as unknown as import("leaflet").Map;
    await loadGeoJsonLayer({
      map,
      urls: { geojsonUrl: "https://example.com/x.geojson" },
      ui: { popup: { fields: [{ key: "name" }] } },
      geojsonInteractive: false,
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

  it("adds CTA buttons to bound popup content when onPopupAction is set", async () => {
    const map = { addTo: vi.fn() } as unknown as import("leaflet").Map;
    const bindArg = { content: null as (() => string) | null };
    geoJSONMock.mockImplementation((data: FeatureCollection, options?: GeoJSONOptions) => {
      if (options?.onEachFeature && data.type === "FeatureCollection") {
        for (const feature of data.features) {
          const leafletFeature = { bindPopup: vi.fn(), on: vi.fn() };
          options.onEachFeature(feature, leafletFeature as never);
          const call = (leafletFeature as { bindPopup: ReturnType<typeof vi.fn> }).bindPopup.mock
            .calls[0] as [() => string] | undefined;
          if (call) bindArg.content = call[0] as () => string;
        }
      }
      return { addTo: vi.fn().mockReturnThis() };
    });

    await loadGeoJsonLayer({
      map,
      urls: { geojsonUrl: "https://example.com/x.geojson" },
      ui: { popup: { fields: [{ key: "name" }] } },
      onPopupAction: () => undefined,
    });

    expect(typeof bindArg.content).toBe("function");
    const html = bindArg.content!();
    expect(html).toContain("data-layer-popup-cta");
  });

  it("binds popups with minWidth/maxWidth LAYER_POPUP_*_WIDTH_PX for readable width", async () => {
    const map = { addTo: vi.fn() } as unknown as import("leaflet").Map;
    let bindPopupMock: ReturnType<typeof vi.fn> | undefined;
    geoJSONMock.mockImplementation((data: FeatureCollection, options?: GeoJSONOptions) => {
      if (options?.onEachFeature && data.type === "FeatureCollection") {
        for (const feature of data.features) {
          bindPopupMock = vi.fn();
          const leafletFeature = { bindPopup: bindPopupMock, on: vi.fn() };
          options.onEachFeature(feature, leafletFeature as never);
        }
      }
      return { addTo: vi.fn().mockReturnThis() };
    });

    await loadGeoJsonLayer({
      map,
      urls: { geojsonUrl: "https://example.com/x.geojson" },
      ui: { popup: { fields: [{ key: "name" }] } },
    });

    expect(bindPopupMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        minWidth: LAYER_POPUP_MIN_WIDTH_PX,
        maxWidth: LAYER_POPUP_MAX_WIDTH_PX,
      }),
    );
  });

  it("stops DOM propagation on feature click when a popup is bound", async () => {
    const map = { addTo: vi.fn() } as unknown as import("leaflet").Map;
    let leafletOn: ReturnType<typeof vi.fn> | undefined;
    geoJSONMock.mockImplementation((data: FeatureCollection, options?: GeoJSONOptions) => {
      if (options?.onEachFeature && data.type === "FeatureCollection") {
        for (const feature of data.features) {
          leafletOn = vi.fn();
          const leafletFeature = {
            bindPopup: vi.fn(),
            on: leafletOn,
          };
          options.onEachFeature(feature, leafletFeature as never);
        }
      }
      return { addTo: vi.fn().mockReturnThis() };
    });

    await loadGeoJsonLayer({
      map,
      urls: { geojsonUrl: "https://example.com/x.geojson" },
      ui: { popup: { fields: [{ key: "name" }] } },
    });

    expect(leafletOn).toHaveBeenCalledWith("click", expect.any(Function));
    const handler = leafletOn!.mock.calls.find((c: unknown[]) => c[0] === "click")?.[1] as (e: {
      originalEvent: Event;
    }) => void;
    const ev = new Event("click");
    handler({ originalEvent: ev });
    expect(stopPropagationMock).toHaveBeenCalledWith(ev);
  });
});
