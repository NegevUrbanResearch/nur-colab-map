import type { PolylineOptions } from "leaflet";
import {
  isAllowedSubmissionDisplayColor,
  normalizeSubmissionDisplayColorHex,
  secondaryHexForPrimaryNormalized,
} from "../../submission/submissionDisplayColor";

/** Longer dashes + shorter gaps so each color reads as its own segments (not one two-tone band). Period must match `PROPOSED_DASH_OFFSET_PRIMARY` (half-period interleave). */
const PROPOSED_DASH = "10 8";
/** Secondary at offset 0; primary shifted by half the dash period so gaps fill with the partner color. */
const PROPOSED_DASH_OFFSET_PRIMARY = "9";

/** Caps/joins for the dual-color proposed stack: `butt` keeps dash ends from overlapping into a solid-looking band. */
const PROPOSED_DUAL_CAP: PolylineOptions["lineCap"] = "butt";
const PROPOSED_DUAL_JOIN: PolylineOptions["lineJoin"] = "miter";

/** Confirmed / persisted pink route segments on the map. */
export const solidLineStyle: PolylineOptions = {
  color: "#FF69B4",
  weight: 5,
  opacity: 0.9,
  lineCap: "round",
  lineJoin: "round",
};

/** Portions replaced by a detour — solid gray, full opacity (no dash; weaker than proposed via weight). */
export const oldLineStyle: PolylineOptions = {
  color: "#ff69b4",
  weight: 4.5,
  opacity: 0.5,
  lineCap: "round",
  lineJoin: "round",
};

/** Drawn beneath `oldLineStyle` polylines for a white halo without changing gray stroke semantics. */
export const oldLineHaloStyle: PolylineOptions = {
  color: "#ffffff",
  weight: 6,
  opacity: 0.22,
  lineCap: "round",
  lineJoin: "round",
};

/** New / proposed detour alignment — stronger than old segments. */
export const proposedLineStyle: PolylineOptions = {
  color: "#ff587b",
  weight: 6,
  opacity: 0.95,
  dashArray: PROPOSED_DASH,
  lineCap: "round",
  lineJoin: "round",
};

/**
 * Solid “track” under proposed dashes (not an outline): wide, soft tint so the line is visible on
 * busy tiles without competing with the colored dashes.
 */
export const proposedLineHaloStyle: PolylineOptions = {
  color: "#e8eef5",
  weight: 10,
  opacity: 0.32,
  lineCap: "round",
  lineJoin: "round",
};

export type RouteLineStylesForDisplay = {
  solid: PolylineOptions;
  old: PolylineOptions;
  proposed: PolylineOptions;
  /** Dashed partner stroke beneath `proposed` when the submission color is palette-valid; omit for invalid colors. */
  proposedSecondary?: PolylineOptions;
  oldHalo: PolylineOptions;
  proposedHalo: PolylineOptions;
};

/**
 * Route stroke styles derived from a submission `displayColor`, or default pink styles when
 * `hex` is missing or not in the submission palette.
 *
 * Product rule: a valid palette color applies **only** to **proposed** diff geometry (dashed
 * detour / proposed alignment). The original heritage axis (`solid`) and removed / ghosted
 * segments (`old`, with `oldHalo`) keep the fixed default pink styles for every submission.
 * `proposedHalo` is a soft solid underlay (light tint) under the dashed proposed stroke.
 * When `proposedSecondary` is set, draw order is halo → secondary dashed → primary dashed (interleaved via `dashOffset` on primary).
 * Dual strokes use `butt` caps so dash ends do not overlap like round caps (which otherwise look like a solid “background” tint).
 */
export function routeLineStylesForDisplayColor(hex: string | null): RouteLineStylesForDisplay {
  const raw = hex?.trim() ?? "";
  if (!raw || !isAllowedSubmissionDisplayColor(raw)) {
    return {
      solid: solidLineStyle,
      old: oldLineStyle,
      proposed: proposedLineStyle,
      oldHalo: oldLineHaloStyle,
      proposedHalo: proposedLineHaloStyle,
    };
  }
  const c = normalizeSubmissionDisplayColorHex(raw)!;
  const secondaryHex = secondaryHexForPrimaryNormalized(c);
  const proposedSecondary: PolylineOptions | undefined =
    secondaryHex != null
      ? {
          color: secondaryHex,
          weight: proposedLineStyle.weight,
          opacity: 0.88,
          dashArray: PROPOSED_DASH,
          lineCap: PROPOSED_DUAL_CAP,
          lineJoin: PROPOSED_DUAL_JOIN,
        }
      : undefined;
  return {
    solid: solidLineStyle,
    old: oldLineStyle,
    proposed: {
      color: c,
      weight: proposedLineStyle.weight,
      opacity: proposedLineStyle.opacity,
      dashArray: PROPOSED_DASH,
      dashOffset: PROPOSED_DASH_OFFSET_PRIMARY,
      lineCap: PROPOSED_DUAL_CAP,
      lineJoin: PROPOSED_DUAL_JOIN,
    },
    ...(proposedSecondary != null ? { proposedSecondary } : {}),
    oldHalo: oldLineHaloStyle,
    proposedHalo: proposedLineHaloStyle,
  };
}
