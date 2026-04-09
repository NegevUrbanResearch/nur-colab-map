/**
 * Integrated route: one continuous path along the pink line with detours to visit user points.
 * Minimizes added length + changePenalty * (removed original length).
 * Solid = unchanged original route; dashed = detour segments (leave → [points] → rejoin).
 * Edit CHANGE_PENALTY below (e.g. 0.5 ≈ no net benefit when replacing 1 km with a detour that adds 500 m).
 */

export type LatLng = [number, number];

function toLatLng(coord: GeoJSON.Position): LatLng {
  return [coord[1], coord[0]];
}

function dist(a: LatLng, b: LatLng): number {
  const dlat = a[0] - b[0];
  const dlng = a[1] - b[1];
  return Math.sqrt(dlat * dlat + dlng * dlng);
}

export function parseDefaultLinePaths(
  geojson: GeoJSON.FeatureCollection
): LatLng[][] {
  const paths: LatLng[][] = [];
  for (const f of geojson.features) {
    const geom = f.geometry;
    if (!geom || geom.type === "Point") continue;
    if (geom.type === "LineString") {
      paths.push(geom.coordinates.map(toLatLng));
    } else if (geom.type === "MultiLineString") {
      for (const ring of geom.coordinates) {
        paths.push(ring.map(toLatLng));
      }
    }
  }
  return paths;
}

function mergePaths(paths: LatLng[][]): LatLng[] {
  if (paths.length === 0) return [];
  const merged: LatLng[] = [];
  for (const path of paths) {
    if (merged.length === 0) {
      merged.push(...path);
    } else {
      const last = merged[merged.length - 1];
      const first = path[0];
      if (last[0] === first[0] && last[1] === first[1]) {
        merged.push(...path.slice(1));
      } else {
        merged.push(...path);
      }
    }
  }
  return merged;
}

function buildPrefixDistances(path: LatLng[]): number[] {
  const prefix: number[] = [0];
  for (let i = 1; i < path.length; i++) {
    prefix[i] = prefix[i - 1] + dist(path[i - 1], path[i]);
  }
  return prefix;
}

function segmentLength(prefix: number[], i: number, j: number): number {
  if (j <= i) return 0;
  return prefix[j] - prefix[i];
}

export const CHANGE_PENALTY = 0.7;

function bestIntervalForPoint(
  path: LatLng[],
  prefix: number[],
  point: LatLng
): { start: number; end: number } | null {
  const n = path.length;
  if (n < 2) return null;
  let bestCost = Number.POSITIVE_INFINITY;
  let bestStart = 0;
  let bestEnd = 0;

  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      const removed = segmentLength(prefix, i, j);
      const added = dist(path[i], point) + dist(point, path[j]);
      const addedDist = added - removed;
      const cost = addedDist + CHANGE_PENALTY * removed;
      if (cost < bestCost) {
        bestCost = cost;
        bestStart = i;
        bestEnd = j;
      }
    }
  }

  return { start: bestStart, end: bestEnd };
}

type Interval = { start: number; end: number };

function mergeIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: Interval[] = [];
  let current = { ...sorted[0] };

  for (let k = 1; k < sorted.length; k++) {
    const next = sorted[k];
    if (next.start <= current.end) {
      current.end = Math.max(current.end, next.end);
    } else {
      merged.push(current);
      current = { ...next };
    }
  }
  merged.push(current);
  return merged;
}

function orderPointsBetweenEndpoints(
  start: LatLng,
  end: LatLng,
  points: LatLng[]
): LatLng[] {
  if (points.length === 0) return [];
  if (points.length === 1) return [...points];
  const route: LatLng[] = [start, end];
  for (const p of points) {
    let bestCost = Number.POSITIVE_INFINITY;
    let bestIdx = 1;
    for (let i = 1; i < route.length; i++) {
      const prev = route[i - 1];
      const next = route[i];
      const added = dist(prev, p) + dist(p, next) - dist(prev, next);
      if (added < bestCost) {
        bestCost = added;
        bestIdx = i;
      }
    }
    route.splice(bestIdx, 0, p);
  }
  return route.slice(1, -1);
}

export interface IntegratedRoute {
  solid: LatLng[][];
  dashed: LatLng[][];
  removed: LatLng[][];
  degradedDashedSegments: number;
}

export function buildIntegratedRoute(
  basePaths: LatLng[][],
  userPoints: LatLng[]
): IntegratedRoute {
  const solid: LatLng[][] = [];
  const dashed: LatLng[][] = [];
  const removed: LatLng[][] = [];

  const basePath = mergePaths(basePaths);
  if (basePath.length === 0) return { solid, dashed, removed, degradedDashedSegments: 0 };

  if (userPoints.length === 0) {
    solid.push([...basePath]);
    return { solid, dashed, removed, degradedDashedSegments: 0 };
  }

  const prefix = buildPrefixDistances(basePath);

  const pointIntervals: { point: LatLng; start: number; end: number }[] = [];
  for (const p of userPoints) {
    const interval = bestIntervalForPoint(basePath, prefix, p);
    if (!interval || interval.end <= interval.start) continue;
    pointIntervals.push({ point: p, start: interval.start, end: interval.end });
  }
  const byStart = [...pointIntervals].sort((a, b) => a.start - b.start);
  const mergedIntervals = mergeIntervals(
    byStart.map((x) => ({ start: x.start, end: x.end }))
  );

  for (const intr of mergedIntervals) {
    const leave = basePath[intr.start];
    const rejoin = basePath[intr.end];
    const inThisDetour = byStart.filter(
      (x) => x.start <= intr.end && x.end >= intr.start
    );
    const pointsInOrder = orderPointsBetweenEndpoints(
      leave,
      rejoin,
      inThisDetour.map((x) => x.point)
    );
    dashed.push([leave, ...pointsInOrder, rejoin]);
    removed.push(basePath.slice(intr.start, intr.end + 1));
  }

  let lastEnd = 0;
  for (const intr of mergedIntervals) {
    if (intr.start > lastEnd) {
      solid.push(basePath.slice(lastEnd, intr.start + 1));
    }
    lastEnd = Math.max(lastEnd, intr.end);
  }
  if (lastEnd < basePath.length - 1) {
    solid.push(basePath.slice(lastEnd, basePath.length));
  }

  return { solid, dashed, removed, degradedDashedSegments: 0 };
}

export interface BuildGoogleIntegratedRouteOptions {
  computeRoute: (waypoints: LatLng[]) => Promise<LatLng[]>;
}

const JITTER_RADII_METERS = [0, 5, 10, 20, 35];
const JITTER_BEARINGS_DEGREES = [0, 60, 120, 180, 240, 300];
const METERS_PER_DEGREE_LAT = 111320;

function metersToLatDegrees(meters: number): number {
  return meters / METERS_PER_DEGREE_LAT;
}

function metersToLngDegrees(meters: number, latitude: number): number {
  const cosLat = Math.cos((latitude * Math.PI) / 180);
  if (Math.abs(cosLat) < 1e-6) return 0;
  return meters / (METERS_PER_DEGREE_LAT * cosLat);
}

function jitterPoint(point: LatLng, radiusMeters: number, bearingDegrees: number): LatLng {
  if (radiusMeters <= 0) return point;
  const angle = (bearingDegrees * Math.PI) / 180;
  const deltaNorth = Math.cos(angle) * radiusMeters;
  const deltaEast = Math.sin(angle) * radiusMeters;
  const latOffset = metersToLatDegrees(deltaNorth);
  const lngOffset = metersToLngDegrees(deltaEast, point[0]);
  return [point[0] + latOffset, point[1] + lngOffset];
}

async function buildGoogleLegWithRetries(
  start: LatLng,
  end: LatLng,
  legIndex: number,
  computeRoute: (waypoints: LatLng[]) => Promise<LatLng[]>
): Promise<LatLng[]> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < JITTER_RADII_METERS.length; attempt++) {
    const radius = JITTER_RADII_METERS[attempt];
    const baseBearing = JITTER_BEARINGS_DEGREES[legIndex % JITTER_BEARINGS_DEGREES.length];
    const bearing = (baseBearing + attempt * 37) % 360;
    const jitteredStart = jitterPoint(start, radius, bearing);
    const jitteredEnd = jitterPoint(end, radius, (bearing + 180) % 360);

    try {
      const points = await computeRoute([jitteredStart, jitteredEnd]);
      if (points.length >= 2) {
        return points;
      }
      lastError = new Error("Route API returned an invalid segment.");
    } catch (_) {
      lastError = _;
    }
  }

  throw new Error(
    `Failed to compute route segment after ${JITTER_RADII_METERS.length} attempts${
      lastError instanceof Error ? `: ${lastError.message}` : "."
    }`
  );
}

async function buildGoogleDashedSegments(
  dashedSegments: LatLng[][],
  computeRoute: (waypoints: LatLng[]) => Promise<LatLng[]>
): Promise<{ dashed: LatLng[][]; degradedDashedSegments: number }> {
  const routedDashed: LatLng[][] = [];

  for (const segment of dashedSegments) {
    if (segment.length < 2) {
      routedDashed.push(segment);
      continue;
    }

    const mergedLegPoints: LatLng[] = [];

    for (let i = 0; i < segment.length - 1; i++) {
      const start = segment[i];
      const end = segment[i + 1];
      const leg = await buildGoogleLegWithRetries(start, end, i, computeRoute);

      if (mergedLegPoints.length === 0) {
        mergedLegPoints.push(...leg);
      } else {
        mergedLegPoints.push(...leg.slice(1));
      }
    }

    routedDashed.push(mergedLegPoints);
  }

  return { dashed: routedDashed, degradedDashedSegments: 0 };
}

export async function buildIntegratedRouteWithGoogleDetours(
  basePaths: LatLng[][],
  userPoints: LatLng[],
  options: BuildGoogleIntegratedRouteOptions
): Promise<IntegratedRoute> {
  const base = buildIntegratedRoute(basePaths, userPoints);
  if (base.dashed.length === 0) return base;

  const routed = await buildGoogleDashedSegments(base.dashed, options.computeRoute);
  return {
    solid: base.solid,
    removed: base.removed,
    dashed: routed.dashed,
    degradedDashedSegments: routed.degradedDashedSegments,
  };
}
