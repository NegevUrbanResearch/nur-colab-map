import { describe, expect, it } from "vitest";
import {
  SUBMISSION_DISPLAY_COLOR_PALETTE,
  normalizeSubmissionDisplayColorHex,
  isAllowedSubmissionDisplayColor,
  listPickableSubmissionDisplayColors,
} from "./submissionDisplayColor";

describe("submissionDisplayColor", () => {
  it("exports a fixed 16-color palette", () => {
    expect(SUBMISSION_DISPLAY_COLOR_PALETTE).toHaveLength(16);
    expect(SUBMISSION_DISPLAY_COLOR_PALETTE[0]).toMatch(/^#[0-9A-F]{6}$/);
  });

  it("normalizeSubmissionDisplayColorHex uppercases and trims", () => {
    expect(normalizeSubmissionDisplayColorHex("  #e11d48 ")).toBe("#E11D48");
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
    expect(isAllowedSubmissionDisplayColor("#E11D48")).toBe(true);
    expect(isAllowedSubmissionDisplayColor("#e11d48")).toBe(true);
    expect(isAllowedSubmissionDisplayColor("#112233")).toBe(false);
    expect(isAllowedSubmissionDisplayColor("")).toBe(false);
  });

  it("every palette entry is allowed", () => {
    for (const c of SUBMISSION_DISPLAY_COLOR_PALETTE) {
      expect(isAllowedSubmissionDisplayColor(c)).toBe(true);
    }
  });

  describe("listPickableSubmissionDisplayColors", () => {
    it("returns full palette order when nothing is used", () => {
      const got = listPickableSubmissionDisplayColors({ usedColorsUpper: [] });
      expect(got).toEqual(
        SUBMISSION_DISPLAY_COLOR_PALETTE.map((h) => normalizeSubmissionDisplayColorHex(h)!)
      );
    });

    it("excludes colors used elsewhere", () => {
      const blocked = SUBMISSION_DISPLAY_COLOR_PALETTE[0]!.toUpperCase();
      const got = listPickableSubmissionDisplayColors({
        usedColorsUpper: [blocked],
      });
      expect(got).not.toContain(normalizeSubmissionDisplayColorHex(SUBMISSION_DISPLAY_COLOR_PALETTE[0]!)!);
      expect(got.length).toBe(15);
    });

    it("still includes self color when it appears in used set", () => {
      const self = SUBMISSION_DISPLAY_COLOR_PALETTE[3]!;
      const selfUpper = self.toUpperCase();
      const used = new Set(SUBMISSION_DISPLAY_COLOR_PALETTE.map((h) => h.toUpperCase()));
      const got = listPickableSubmissionDisplayColors({
        usedColorsUpper: used,
        selfColorUpper: selfUpper,
      });
      expect(got).toEqual([normalizeSubmissionDisplayColorHex(self)!]);
    });

    it("treats loaded overwrite color as self when used elsewhere", () => {
      const loaded = SUBMISSION_DISPLAY_COLOR_PALETTE[2]!;
      const upper = loaded.toUpperCase();
      const got = listPickableSubmissionDisplayColors({
        usedColorsUpper: [upper],
        loadedOverwriteColorUpper: upper,
      });
      expect(got).toContain(normalizeSubmissionDisplayColorHex(loaded)!);
    });

    it("normalizes iterable entries to uppercase for used set", () => {
      const hex = SUBMISSION_DISPLAY_COLOR_PALETTE[1]!;
      const got = listPickableSubmissionDisplayColors({
        usedColorsUpper: [hex.toLowerCase()],
      });
      expect(got).not.toContain(normalizeSubmissionDisplayColorHex(hex)!);
    });
  });
});
