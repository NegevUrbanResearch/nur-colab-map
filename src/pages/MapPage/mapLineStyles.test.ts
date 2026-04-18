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
  });

  it("tints only proposed geometry for an allowed hex; solid and old stay default refs", () => {
    const s = routeLineStylesForDisplayColor("#e11d48");
    expect(s.solid).toBe(solidLineStyle);
    expect(s.old).toBe(oldLineStyle);

    expect(s.proposed).not.toBe(proposedLineStyle);
    expect(s.proposed.color).toBe("#E11D48");
    expect(s.proposed.weight).toBe(proposedLineStyle.weight);
    expect(s.proposed.opacity).toBe(proposedLineStyle.opacity);
    expect(s.proposed.dashArray).toBe(proposedLineStyle.dashArray);

    expect(s.oldHalo).toBe(oldLineHaloStyle);
    expect(s.proposedHalo).toBe(proposedLineHaloStyle);
  });
});
