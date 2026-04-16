import { describe, expect, it } from "vitest";
import {
  oldLineHaloStyle,
  oldLineStyle,
  proposedLineHaloStyle,
  proposedLineStyle,
} from "./mapLineStyles";

describe("map line styles", () => {
  it("keeps replaced segments solid (no dash) and visually weaker than proposed", () => {
    expect(oldLineStyle.dashArray).toBeUndefined();
    expect(oldLineStyle.weight ?? 0).toBeGreaterThanOrEqual(4);
    expect(oldLineStyle.weight ?? 0).toBeLessThan(proposedLineStyle.weight ?? 99);
    expect(proposedLineStyle.dashArray).toBeDefined();
  });

  it("uses a white halo underlay wider than the gray old line", () => {
    expect(oldLineHaloStyle.color?.toLowerCase()).toBe("#ffffff");
    expect(oldLineHaloStyle.dashArray).toBeUndefined();
    expect(oldLineHaloStyle.weight ?? 0).toBeGreaterThan(oldLineStyle.weight ?? 0);
  });

  it("uses a solid white halo underlay wider than the dashed proposed line", () => {
    expect(proposedLineHaloStyle.color?.toLowerCase()).toBe("#ffffff");
    expect(proposedLineHaloStyle.dashArray).toBeUndefined();
    expect(proposedLineHaloStyle.weight ?? 0).toBeGreaterThan(proposedLineStyle.weight ?? 0);
  });
});
