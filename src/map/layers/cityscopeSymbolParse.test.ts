import { describe, expect, it } from "vitest";
import { parseDefaultSymbolFromStyle } from "./cityscopeSymbolParse";

describe("parseDefaultSymbolFromStyle", () => {
  it("reads dash.array into stroke dash numbers", () => {
    const style = {
      type: "line",
      renderer: "simple",
      defaultSymbol: {
        symbolLayers: [
          {
            type: "stroke",
            color: "#111",
            width: 2,
            opacity: 1,
            dash: { array: [4, 4] },
          },
        ],
      },
    };
    const p = parseDefaultSymbolFromStyle(style);
    expect(p?.stroke?.dash).toEqual([4, 4]);
  });
});
