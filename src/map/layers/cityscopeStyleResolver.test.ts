import { describe, expect, it } from "vitest";
import { resolveStyleForFeature } from "./cityscopeStyleResolver";

const style = {
  type: "polygon",
  renderer: "uniqueValue",
  uniqueValues: {
    field: "Muni_Heb",
    classes: [{ value: "אשכול", symbol: { symbolLayers: [{ type: "stroke", color: "#111111", width: 2, opacity: 1 }] } }],
  },
  defaultSymbol: { symbolLayers: [{ type: "stroke", color: "#999999", width: 1, opacity: 1 }] },
};

describe("resolveStyleForFeature", () => {
  it("picks class symbol for matching field", () => {
    const r = resolveStyleForFeature(style, { Muni_Heb: "אשכול" });
    expect(r.strokeLayers[0]?.color).toBe("#111111");
  });

  it("falls back to defaultSymbol when class misses", () => {
    const r = resolveStyleForFeature(style, { Muni_Heb: "לא_מוגדר" });
    expect(r.strokeLayers[0]?.color).toBe("#999999");
  });

  it("matches field names case-insensitively", () => {
    const r = resolveStyleForFeature(style, { muni_heb: "אשכול" });
    expect(r.strokeLayers[0]?.color).toBe("#111111");
  });

  it("parses markerPoint icon fields like the default-symbol parser path", () => {
    const withIcon = {
      type: "point",
      renderer: "simple",
      defaultSymbol: {
        symbolLayers: [
          {
            type: "markerPoint",
            marker: {
              shape: "circle",
              size: 10,
              fillColor: "#00f",
              strokeColor: "#000",
              strokeWidth: 1,
              iconUrl: " https://example.com/i.png ",
              iconSize: [24, 32],
              iconAnchor: [12, 32],
            },
          },
        ],
      },
    };
    const r = resolveStyleForFeature(withIcon, {});
    expect(r.markerPointLayer?.iconUrl).toBe("https://example.com/i.png");
    expect(r.markerPointLayer?.iconSize).toEqual([24, 32]);
    expect(r.markerPointLayer?.iconAnchor).toEqual([12, 32]);
  });

  it("keeps only finite numeric dash segments", () => {
    const dashed = {
      type: "line",
      renderer: "simple",
      defaultSymbol: {
        symbolLayers: [
          {
            type: "stroke",
            color: "#000",
            width: 2,
            opacity: 1,
            dash: [4, Number.NaN, "x" as unknown as number, 3, Infinity],
          },
        ],
      },
    };
    const r = resolveStyleForFeature(dashed, {});
    expect(r.strokeLayers[0]?.dash).toEqual([4, 3]);
  });

  it("parses CIM dash object with array (e.g. סינגלים)", () => {
    const cimDash = {
      type: "line",
      renderer: "simple",
      defaultSymbol: {
        symbolLayers: [
          {
            type: "stroke",
            color: "#abdbe3",
            width: 1.02,
            opacity: 1,
            dash: { array: [1.47, 1.47] },
          },
          { type: "stroke", color: "#704589", width: 1.33, opacity: 1, dash: null },
        ],
      },
    };
    const r = resolveStyleForFeature(cimDash, {});
    expect(r.strokeLayers[0]?.dash).toEqual([1.47, 1.47]);
    expect(r.strokeLayers[1]?.dash).toBeUndefined();
  });
});
