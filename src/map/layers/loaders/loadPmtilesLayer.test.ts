import { describe, expect, it, vi, beforeEach } from "vitest";
import type { LeafletMouseEvent, Map as LeafletMap } from "leaflet";

const { leafletLayerMock, leafletPopupMock } = vi.hoisted(() => {
  const makePopup = () => ({
    setLatLng: vi.fn().mockReturnThis(),
    setContent: vi.fn().mockReturnThis(),
    openOn: vi.fn(),
    once: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    getElement: vi.fn(() => null),
    getLatLng: vi.fn(() => ({ lat: 1, lng: 2 })),
  });
  return {
    leafletLayerMock: vi.fn(),
    leafletPopupMock: vi.fn(() => makePopup()),
  };
});

vi.mock("leaflet", () => ({
  default: {
    DomEvent: { stopPropagation: vi.fn() },
    popup: leafletPopupMock,
  },
}));

vi.mock("protomaps-leaflet", async (importOriginal) => {
  const actual = await importOriginal<typeof import("protomaps-leaflet")>();
  return {
    ...actual,
    leafletLayer: (...args: unknown[]) => leafletLayerMock(...args),
  };
});

import * as advancedPmtiles from "../advancedPmtilesLayer";
import { LAYER_POPUP_MAX_WIDTH_PX, LAYER_POPUP_MIN_WIDTH_PX } from "../popupLayout";
import { loadPmtilesLayer } from "./loadPmtilesLayer";

describe("loadPmtilesLayer", () => {
  const mockMap = {
    wrapLatLng: (ll: { lat: number; lng: number }) => ll,
  } as unknown as LeafletMap;

  beforeEach(() => {
    leafletLayerMock.mockReset();
    leafletPopupMock.mockClear();
    leafletLayerMock.mockReturnValue({
      addTo: vi.fn().mockReturnThis(),
      on: vi.fn(),
      options: { interactive: false as boolean },
      queryTileFeaturesDebug: undefined as unknown,
    });
  });

  it("dispatches markerLine styles to createAdvancedPmtilesLayer", async () => {
    const spy = vi.spyOn(advancedPmtiles, "createAdvancedPmtilesLayer");
    const markerLineStyle = {
      type: "line",
      renderer: "simple",
      defaultSymbol: {
        symbolLayers: [
          {
            type: "markerLine",
            marker: { shape: "square", size: 5, strokeColor: "#000", strokeWidth: 1 },
            placement: { interval: 15, offsetAlong: 7.5 },
          },
          { type: "stroke", color: "#895a44", width: 5, opacity: 1 },
        ],
      },
    };

    await loadPmtilesLayer({
      map: mockMap,
      urls: { pmtilesUrl: "https://example.com/tiles.pmtiles" },
      style: markerLineStyle,
      layerGeometryType: "line",
      pmtilesSourceLayer: "layer",
    });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        dataLayer: "layer",
        geometryHint: "line",
        style: markerLineStyle,
      }),
    );
    expect(leafletLayerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        paintRules: expect.any(Array),
      }),
    );
    spy.mockRestore();
  });

  it("dispatches dashed stroke styles to createAdvancedPmtilesLayer", async () => {
    const spy = vi.spyOn(advancedPmtiles, "createAdvancedPmtilesLayer");
    const dashedStyle = {
      type: "line",
      renderer: "simple",
      defaultSymbol: {
        symbolLayers: [{ type: "stroke", color: "#000", width: 2, opacity: 1, dash: [4, 2] }],
      },
    };

    await loadPmtilesLayer({
      map: mockMap,
      urls: { pmtilesUrl: "https://example.com/tiles.pmtiles" },
      style: dashedStyle,
      layerGeometryType: "line",
    });

    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("dispatches CIM dash { array } stroke styles to createAdvancedPmtilesLayer", async () => {
    const spy = vi.spyOn(advancedPmtiles, "createAdvancedPmtilesLayer");
    const dashedStyle = {
      type: "line",
      renderer: "simple",
      defaultSymbol: {
        symbolLayers: [{ type: "stroke", color: "#000", width: 2, opacity: 1, dash: { array: [4, 2] } }],
      },
    };

    await loadPmtilesLayer({
      map: mockMap,
      urls: { pmtilesUrl: "https://example.com/tiles.pmtiles" },
      style: dashedStyle,
      layerGeometryType: "line",
    });

    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("dispatches multi-stroke styles to createAdvancedPmtilesLayer", async () => {
    const spy = vi.spyOn(advancedPmtiles, "createAdvancedPmtilesLayer");
    const multiStrokeStyle = {
      type: "line",
      renderer: "simple",
      defaultSymbol: {
        symbolLayers: [
          { type: "stroke", color: "#111", width: 4, opacity: 1 },
          { type: "stroke", color: "#eee", width: 1, opacity: 1 },
        ],
      },
    };

    await loadPmtilesLayer({
      map: mockMap,
      urls: { pmtilesUrl: "https://example.com/tiles.pmtiles" },
      style: multiStrokeStyle,
      layerGeometryType: "line",
    });

    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("uses styleToLeaflet paint rules for a simple single stroke without markerLine or dash", async () => {
    const spy = vi.spyOn(advancedPmtiles, "createAdvancedPmtilesLayer");
    const simpleStyle = {
      type: "line",
      renderer: "simple",
      defaultSymbol: {
        symbolLayers: [{ type: "stroke", color: "#00f", width: 2, opacity: 1 }],
      },
    };

    await loadPmtilesLayer({
      map: mockMap,
      urls: { pmtilesUrl: "https://example.com/tiles.pmtiles" },
      style: simpleStyle,
      layerGeometryType: "line",
    });

    expect(spy).not.toHaveBeenCalled();
    const call = leafletLayerMock.mock.calls[0]?.[0] as { paintRules: unknown[] } | undefined;
    expect(call?.paintRules?.length).toBe(1);
    spy.mockRestore();
  });

  it("enables interactive grid and click bridge when ui declares popup fields and pick API exists", async () => {
    const queryTileFeaturesDebug = vi.fn();
    const grid = {
      addTo: vi.fn().mockReturnThis(),
      on: vi.fn(),
      options: { interactive: false as boolean },
      queryTileFeaturesDebug,
    };
    leafletLayerMock.mockReturnValue(grid);

    await loadPmtilesLayer({
      map: mockMap,
      urls: { pmtilesUrl: "https://example.com/tiles.pmtiles" },
      ui: { popup: { fields: [{ key: "name" }] } },
    });

    const leafletOpts = leafletLayerMock.mock.calls[0]?.[0] as { interactive?: boolean } | undefined;
    expect(leafletOpts?.interactive).toBe(false);
    expect(grid.options.interactive).toBe(true);
    expect(grid.on).toHaveBeenCalledWith("click", expect.any(Function));
  });

  it("creates L.popup with minWidth/maxWidth when click bridge runs and a feature is picked", async () => {
    const pickMap = new Map([
      [
        "src",
        [
          {
            layerName: "layer",
            feature: { props: { name: "Picked" } },
          },
        ],
      ],
    ]);
    const queryTileFeaturesDebug = vi.fn().mockReturnValue(pickMap);
    const grid = {
      addTo: vi.fn().mockReturnThis(),
      on: vi.fn(),
      options: { interactive: false as boolean },
      queryTileFeaturesDebug,
    };
    leafletLayerMock.mockReturnValue(grid);

    await loadPmtilesLayer({
      map: mockMap,
      urls: { pmtilesUrl: "https://example.com/tiles.pmtiles" },
      ui: { popup: { fields: [{ key: "name" }] } },
      pmtilesSourceLayer: "layer",
    });

    const registerClick = (grid.on as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => c[0] === "click",
    );
    const onClick = registerClick?.[1] as ((e: LeafletMouseEvent) => void) | undefined;
    expect(onClick).toBeTypeOf("function");
    onClick!({
      latlng: { lat: 32, lng: 34.8 },
      originalEvent: undefined,
    } as unknown as LeafletMouseEvent);

    expect(leafletPopupMock).toHaveBeenCalledWith(
      expect.objectContaining({
        className: "layer-popup-embed",
        minWidth: LAYER_POPUP_MIN_WIDTH_PX,
        maxWidth: LAYER_POPUP_MAX_WIDTH_PX,
      }),
    );
  });

  it("does not enable interactive or register click bridge without popup fields", async () => {
    const queryTileFeaturesDebug = vi.fn();
    const grid = {
      addTo: vi.fn().mockReturnThis(),
      on: vi.fn(),
      options: { interactive: false as boolean },
      queryTileFeaturesDebug,
    };
    leafletLayerMock.mockReturnValue(grid);

    await loadPmtilesLayer({
      map: mockMap,
      urls: { pmtilesUrl: "https://example.com/tiles.pmtiles" },
    });

    const leafletOpts = leafletLayerMock.mock.calls[0]?.[0] as { interactive?: boolean } | undefined;
    expect(leafletOpts?.interactive).toBe(false);
    expect(grid.options.interactive).toBe(false);
    expect(grid.on).not.toHaveBeenCalled();
  });

  it("disables popup bridge when pmtilesInteractive is false even if ui declares popup fields", async () => {
    const queryTileFeaturesDebug = vi.fn();
    const grid = {
      addTo: vi.fn().mockReturnThis(),
      on: vi.fn(),
      options: { interactive: false as boolean },
      queryTileFeaturesDebug,
    };
    leafletLayerMock.mockReturnValue(grid);

    await loadPmtilesLayer({
      map: mockMap,
      urls: { pmtilesUrl: "https://example.com/tiles.pmtiles" },
      ui: { popup: { fields: [{ key: "name" }] } },
      pmtilesInteractive: false,
    });

    const leafletOpts = leafletLayerMock.mock.calls[0]?.[0] as { interactive?: boolean } | undefined;
    expect(leafletOpts?.interactive).toBe(false);
    expect(grid.options.interactive).toBe(false);
    expect(grid.on).not.toHaveBeenCalled();
  });

  it("does not enable interactive or click handling when pick API is missing but ui declares popups", async () => {
    const grid: {
      addTo: ReturnType<typeof vi.fn>;
      on: ReturnType<typeof vi.fn>;
      options: { interactive: boolean };
    } = {
      addTo: vi.fn().mockReturnThis(),
      on: vi.fn(),
      options: { interactive: false },
    };
    leafletLayerMock.mockReturnValue(grid);

    await loadPmtilesLayer({
      map: mockMap,
      urls: { pmtilesUrl: "https://example.com/tiles.pmtiles" },
      ui: { popup: { fields: [{ key: "name" }] } },
    });

    const leafletOpts = leafletLayerMock.mock.calls[0]?.[0] as { interactive?: boolean } | undefined;
    expect(leafletOpts?.interactive).toBe(false);
    expect(grid.options.interactive).toBe(false);
    expect(grid.on).not.toHaveBeenCalled();
  });
});
