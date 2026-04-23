import { describe, expect, it, vi } from "vitest";

vi.mock("leaflet", () => ({
  default: {
    icon: vi.fn(() => ({})),
    point: vi.fn((x: number, y: number) => ({ x, y })),
    marker: vi.fn(),
    circleMarker: vi.fn(),
  },
}));

import type { LayerManifestEntry } from "./types";
import { geojsonAdapterFromPackStyle } from "./geojsonStyleFromPack";

describe("geojsonAdapterFromPackStyle", () => {
  it("returns class-specific stroke for feature properties (uniqueValue)", () => {
    const style = {
      type: "line",
      renderer: "uniqueValue",
      uniqueValues: {
        field: "Muni_Heb",
        classes: [
          {
            value: "אשכול",
            symbol: {
              symbolLayers: [{ type: "stroke", color: "#111111", width: 2, opacity: 1 }],
            },
          },
        ],
      },
      defaultSymbol: {
        symbolLayers: [{ type: "stroke", color: "#999999", width: 1, opacity: 1 }],
      },
    };
    const layer = {
      id: "x",
      name: "x",
      file: "x.geojson",
      format: "geojson",
      geometryType: "line",
    } as const satisfies LayerManifestEntry;

    const adapter = geojsonAdapterFromPackStyle(style, layer);
    const styleFn = adapter.geojsonStyle;
    expect(typeof styleFn).toBe("function");
    const paint = (
      styleFn as (f?: { properties?: Record<string, unknown> }) => Record<string, unknown>
    )({
      properties: { Muni_Heb: "אשכול" },
    });
    expect(paint.color).toBe("#111111");
  });
});
