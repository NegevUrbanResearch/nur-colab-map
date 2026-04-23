/**
 * Pure guard for async parking layer loads: only apply GeoJSON results when the
 * user still wants parking and the load session has not been bumped (off toggle,
 * map teardown, etc.).
 */
export type ParkingLoadResultDisposition = "apply" | "discard";

export function dispositionForParkingLoadResult(opts: {
  sessionAtStart: number;
  currentSession: number;
  layerWanted: boolean;
}): ParkingLoadResultDisposition {
  if (opts.layerWanted && opts.currentSession === opts.sessionAtStart) return "apply";
  return "discard";
}
