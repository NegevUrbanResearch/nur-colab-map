import { describe, expect, it } from "vitest";
import { oldLineStyle, proposedLineStyle } from "./mapLineStyles";

describe("map line styles", () => {
  it("keeps old segment visible while still weaker than proposed", () => {
    expect(oldLineStyle.opacity ?? 0).toBeGreaterThanOrEqual(0.62);
    expect(oldLineStyle.weight ?? 0).toBeGreaterThanOrEqual(4);
    expect(oldLineStyle.opacity ?? 1).toBeLessThan(proposedLineStyle.opacity ?? 1);
    expect(oldLineStyle.weight ?? 0).toBeLessThan(proposedLineStyle.weight ?? 99);
  });
});
