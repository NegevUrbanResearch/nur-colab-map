import { describe, expect, it } from "vitest";
import {
  SUBMISSION_DISPLAY_COLOR_PALETTE,
  normalizeSubmissionDisplayColorHex,
  isAllowedSubmissionDisplayColor,
} from "./submissionDisplayColor";

describe("submissionDisplayColor", () => {
  it("exports a fixed 16-color palette", () => {
    expect(SUBMISSION_DISPLAY_COLOR_PALETTE).toHaveLength(16);
    expect(SUBMISSION_DISPLAY_COLOR_PALETTE[0]).toMatch(/^#[0-9A-F]{6}$/);
  });

  it("normalizeSubmissionDisplayColorHex uppercases and trims", () => {
    expect(normalizeSubmissionDisplayColorHex("  #c1121f ")).toBe("#C1121F");
  });

  it("normalizeSubmissionDisplayColorHex returns null for invalid", () => {
    expect(normalizeSubmissionDisplayColorHex("#GGGGGG")).toBeNull();
    expect(normalizeSubmissionDisplayColorHex("red")).toBeNull();
    expect(normalizeSubmissionDisplayColorHex("")).toBeNull();
    expect(normalizeSubmissionDisplayColorHex("   ")).toBeNull();
    expect(normalizeSubmissionDisplayColorHex("#12345")).toBeNull();
    expect(normalizeSubmissionDisplayColorHex("#1234567")).toBeNull();
    expect(normalizeSubmissionDisplayColorHex("#abc")).toBeNull();
  });

  it("isAllowedSubmissionDisplayColor accepts only palette members", () => {
    expect(isAllowedSubmissionDisplayColor("#C1121F")).toBe(true);
    expect(isAllowedSubmissionDisplayColor("#c1121f")).toBe(true);
    expect(isAllowedSubmissionDisplayColor("#112233")).toBe(false);
    expect(isAllowedSubmissionDisplayColor("")).toBe(false);
  });

  it("every palette entry is allowed", () => {
    for (const c of SUBMISSION_DISPLAY_COLOR_PALETTE) {
      expect(isAllowedSubmissionDisplayColor(c)).toBe(true);
    }
  });
});
