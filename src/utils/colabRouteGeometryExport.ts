import type { DetourPaintPiece, IntegratedRoute, LatLng } from "./pinkLineRoute";

/** GeoJSON position order in exported JSON (RFC 7946). Internal `LatLng` remains [lat, lng]. */
export type LngLat = [number, number];

export const COLAB_ROUTE_GEOMETRY_EXPORT_VERSION = 1 as const;

export interface ColabRouteGeometryBundle {
  detour_export_version: typeof COLAB_ROUTE_GEOMETRY_EXPORT_VERSION;
  integrated_route: {
    solid: Array<{ coordinates: LngLat[] }>;
    removed: Array<{ coordinates: LngLat[] }>;
  };
  detour_paint: {
    road: Array<{ coordinates: LngLat[] }>;
    offroad: Array<{ road_end: LngLat; target: LngLat }>;
    junctions: LngLat[];
  };
}

function toLngLat([lat, lng]: LatLng): LngLat {
  return [lng, lat];
}

function ringLngLat(ring: LatLng[]): LngLat[] {
  return ring.map(toLngLat);
}

function collectJunctionsFromPaint(pieces: DetourPaintPiece[]): LngLat[] {
  const out: LngLat[] = [];
  for (const p of pieces) {
    if (p.kind === "offroad") {
      out.push(toLngLat(p.roadEnd));
    }
  }
  return out;
}

/**
 * Serializes the same `IntegratedRoute` snapshot used for map painting after routing.
 * When `detourPaint` is absent, proposed geometry is taken from `dashed` as road polylines.
 */
export function serializeIntegratedRouteToColabBundle(
  route: IntegratedRoute
): ColabRouteGeometryBundle {
  const solid = route.solid.map((ring) => ({ coordinates: ringLngLat(ring) }));
  const removed = route.removed.map((ring) => ({ coordinates: ringLngLat(ring) }));

  const road: Array<{ coordinates: LngLat[] }> = [];
  const offroad: Array<{ road_end: LngLat; target: LngLat }> = [];

  if (route.detourPaint && route.detourPaint.length > 0) {
    for (const piece of route.detourPaint) {
      if (piece.kind === "road") {
        road.push({ coordinates: ringLngLat(piece.points) });
      } else {
        offroad.push({
          road_end: toLngLat(piece.roadEnd),
          target: toLngLat(piece.target),
        });
      }
    }
  } else {
    for (const seg of route.dashed) {
      if (seg.length >= 2) road.push({ coordinates: ringLngLat(seg) });
    }
  }

  const junctions =
    route.detourPaint && route.detourPaint.length > 0
      ? collectJunctionsFromPaint(route.detourPaint)
      : [];

  return {
    detour_export_version: COLAB_ROUTE_GEOMETRY_EXPORT_VERSION,
    integrated_route: { solid, removed },
    detour_paint: { road, offroad, junctions },
  };
}
