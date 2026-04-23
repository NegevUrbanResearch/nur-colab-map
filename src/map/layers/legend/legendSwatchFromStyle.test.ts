import { describe, expect, it } from "vitest";
import { legendSwatchFromStyle } from "./legendSwatchFromStyle";

describe("legendSwatchFromStyle", () => {
  it("returns line swatch from default stroke symbol", () => {
    const style = {
      type: "line",
      renderer: "simple",
      defaultSymbol: {
        symbolLayers: [{ type: "stroke", color: "#873e23", width: 5, opacity: 1, dash: null }],
      },
    };
    const s = legendSwatchFromStyle(style, "line");
    expect(s).toEqual({
      kind: "line",
      strokeColor: "#873e23",
      strokeWidth: 5,
      strokeOpacity: 1,
    });
  });

  it("includes strokeDasharray when stroke uses dash or dashArray", () => {
    const styleDash = {
      type: "line",
      renderer: "simple",
      defaultSymbol: {
        symbolLayers: [{ type: "stroke", color: "#111", width: 3, opacity: 1, dash: [4, 3] }],
      },
    };
    expect(legendSwatchFromStyle(styleDash, "line")).toMatchObject({
      kind: "line",
      strokeDasharray: "4 3",
    });
    const styleDashArray = {
      type: "line",
      renderer: "simple",
      defaultSymbol: {
        symbolLayers: [{ type: "stroke", color: "#222", width: 2, opacity: 0.8, dashArray: [10, 14] }],
      },
    };
    expect(legendSwatchFromStyle(styleDashArray, "line")).toMatchObject({
      kind: "line",
      strokeColor: "#222",
      strokeDasharray: "10 14",
    });
  });

  it("returns point swatch from markerPoint symbol", () => {
    const style = {
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
    const s = legendSwatchFromStyle(style, "point");
    expect(s?.kind).toBe("point");
    expect(s?.fillColor).toBe("#0d47a1");
    expect(s?.pointShape).toBe("circle");
  });

  it("returns polygon swatch from fill and stroke", () => {
    const style = {
      type: "polygon",
      defaultSymbol: {
        symbolLayers: [
          { type: "fill", fillType: "solid", color: "#d76e89", opacity: 0.8 },
          { type: "stroke", color: "#000000", width: 1, opacity: 1, dash: null },
        ],
      },
    };
    const s = legendSwatchFromStyle(style, "polygon");
    expect(s?.kind).toBe("polygon");
    expect(s?.fillColor).toBe("#d76e89");
    expect(s?.strokeColor).toBe("#000000");
  });

  it("returns undefined when style has no defaultSymbol", () => {
    expect(legendSwatchFromStyle({}, "line")).toBeUndefined();
  });
});
