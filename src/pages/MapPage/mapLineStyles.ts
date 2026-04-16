import type { PolylineOptions } from "leaflet";

/** Confirmed / persisted pink route segments on the map. */
export const solidLineStyle: PolylineOptions = {
  color: "#FF69B4",
  weight: 5,
  opacity: 0.9,
  lineCap: "round",
  lineJoin: "round",
};

/** Portions replaced by a detour — visually de-emphasized vs proposed. */
export const oldLineStyle: PolylineOptions = {
  color: "#6D7887",
  weight: 4.5,
  opacity: 0.68,
  dashArray: "2 7",
  lineCap: "round",
  lineJoin: "round",
};

/** New / proposed detour alignment — stronger than old segments. */
export const proposedLineStyle: PolylineOptions = {
  color: "#FF4FA3",
  weight: 6,
  opacity: 0.95,
  dashArray: "4 7",
  lineCap: "round",
  lineJoin: "round",
};
