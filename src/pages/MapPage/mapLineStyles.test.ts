import { describe, expect, it } from "vitest";
import {
  oldLineHaloStyle,
  oldLineStyle,
  proposedLineHaloStyle,
  proposedLineStyle,
  routeLineStylesForDisplayColor,
  solidLineStyle,
} from "./mapLineStyles";

describe("routeLineStylesForDisplayColor", () => {
  it.each([
    ["null", null],
    ["empty", ""],
    ["whitespace", "   "],
    ["invalid hex", "#GGGGGG"],
    ["non-palette hex", "#112233"],
  ])("returns default style references for %s", (_label, hex) => {
    const s = routeLineStylesForDisplayColor(hex);
    expect(s.solid).toBe(solidLineStyle);
    expect(s.old).toBe(oldLineStyle);
    expect(s.proposed).toBe(proposedLineStyle);
    expect(s.oldHalo).toBe(oldLineHaloStyle);
    expect(s.proposedHalo).toBe(proposedLineHaloStyle);
    expect(s.proposedSecondary).toBeUndefined();
  });

  it("tints only proposed geometry for an allowed hex; solid and old stay default refs", () => {
    const s = routeLineStylesForDisplayColor("#DC2626");
    expect(s.solid).toBe(solidLineStyle);
    expect(s.old).toBe(oldLineStyle);

    expect(s.proposed).not.toBe(proposedLineStyle);
    expect(s.proposed.color).toBe("#DC2626");
    expect(s.proposed.weight).toBe(proposedLineStyle.weight);
    expect(s.proposed.opacity).toBe(proposedLineStyle.opacity);
    expect(s.proposed.dashArray).toBe(proposedLineStyle.dashArray);
    expect(s.proposed.dashOffset).toBe("9");

    expect(s.proposedSecondary).toBeDefined();
    expect(s.proposedSecondary!.color).toBe("#22D3EE");
    expect(s.proposedSecondary!.weight).toBe(proposedLineStyle.weight);
    expect(s.proposedSecondary!.opacity).toBe(0.88);
    expect(s.proposedSecondary!.dashArray).toBe(proposedLineStyle.dashArray);
    expect(s.proposedSecondary!.lineCap).toBe("butt");
    expect(s.proposedSecondary!.lineJoin).toBe("miter");
    expect(s.proposed.lineCap).toBe("butt");
    expect(s.proposed.lineJoin).toBe("miter");
    expect(
      s.proposedSecondary!.dashOffset === undefined || s.proposedSecondary!.dashOffset === "0",
    ).toBe(true);

    expect(s.oldHalo).toBe(oldLineHaloStyle);
    expect(s.proposedHalo).toBe(proposedLineHaloStyle);
  });
});
