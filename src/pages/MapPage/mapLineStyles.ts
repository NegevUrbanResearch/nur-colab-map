import type { PolylineOptions } from "leaflet";

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
