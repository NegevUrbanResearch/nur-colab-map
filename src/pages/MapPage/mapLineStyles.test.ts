import { describe, expect, it } from "vitest";
import { oldLineHaloStyle, oldLineStyle, proposedLineStyle } from "./mapLineStyles";

describe("map line styles", () => {
  it("keeps old segment solid gray at full opacity while still weaker than proposed", () => {
    expect(oldLineStyle.dashArray).toBeUndefined();
    expect(oldLineStyle.opacity).toBe(1);
    expect(oldLineStyle.color).toBe("#6D7887");
    expect(oldLineStyle.weight ?? 0).toBeGreaterThanOrEqual(4);
    expect(oldLineStyle.weight ?? 0).toBeLessThan(proposedLineStyle.weight ?? 99);
    expect(proposedLineStyle.dashArray).toBeDefined();
  });

  it("uses a white halo underlay wider than the gray old line", () => {
    expect(oldLineHaloStyle.color?.toLowerCase()).toBe("#ffffff");
    expect(oldLineHaloStyle.dashArray).toBeUndefined();
    expect(oldLineHaloStyle.weight ?? 0).toBeGreaterThan(oldLineStyle.weight ?? 0);
  });
});
