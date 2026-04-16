import { describe, expect, it } from "vitest";
import { oldLineStyle, proposedLineStyle } from "./mapLineStyles";

describe("map line styles", () => {
  it("makes old line visually weaker than proposed line", () => {
    expect(oldLineStyle.opacity).toBeLessThan(proposedLineStyle.opacity ?? 1);
    expect(oldLineStyle.weight).toBeLessThan(proposedLineStyle.weight ?? 99);
  });
});
