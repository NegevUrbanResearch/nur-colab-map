import type { PolylineOptions } from "leaflet";
import {
  isAllowedSubmissionDisplayColor,
  normalizeSubmissionDisplayColorHex,
} from "../../submission/submissionDisplayColor";

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
  dashArray: "3 7",
  lineCap: "round",
  lineJoin: "round",
};

/** Drawn beneath `proposedLineStyle` polylines for a white halo (solid stroke; dashed line on top). */
export const proposedLineHaloStyle: PolylineOptions = {
  color: "#ffffff",
  weight: 7,
  opacity: 0.22,
  lineCap: "round",
  lineJoin: "round",
};

export type RouteLineStylesForDisplay = {
  solid: PolylineOptions;
  old: PolylineOptions;
  proposed: PolylineOptions;
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
 * `proposedHalo` stays the default white halo under the dashed proposed stroke.
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
  return {
    solid: solidLineStyle,
    old: oldLineStyle,
    proposed: {
      color: c,
      weight: proposedLineStyle.weight,
      opacity: proposedLineStyle.opacity,
      dashArray: proposedLineStyle.dashArray,
      lineCap: "round",
      lineJoin: "round",
    },
    oldHalo: oldLineHaloStyle,
    proposedHalo: proposedLineHaloStyle,
  };
}
