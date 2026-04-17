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

  it("returns palette-colored strokes and default halos for an allowed hex", () => {
    const s = routeLineStylesForDisplayColor("#c1121f");
    expect(s.solid).not.toBe(solidLineStyle);
    expect(s.solid.color).toBe("#C1121F");
    expect(s.solid.weight).toBe(solidLineStyle.weight);
    expect(s.solid.opacity).toBe(solidLineStyle.opacity);

    expect(s.old.color).toBe("#C1121F");
    expect(s.old.weight).toBe(oldLineStyle.weight);
    expect(s.old.opacity).toBe(oldLineStyle.opacity);

    expect(s.proposed.color).toBe("#C1121F");
    expect(s.proposed.weight).toBe(proposedLineStyle.weight);
    expect(s.proposed.opacity).toBe(proposedLineStyle.opacity);
    expect(s.proposed.dashArray).toBe(proposedLineStyle.dashArray);

    expect(s.oldHalo).toBe(oldLineHaloStyle);
    expect(s.proposedHalo).toBe(proposedLineHaloStyle);
  });
});
