/**
 * Heritage axis from GeoJSON is split into continuous runs (no artificial long chords). Detours
 * (dashed / removed) apply only when user points are present; each point is tied to the nearest run.
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

const EARTH_RADIUS_M = 6_371_000;
const MAX_HERITAGE_GAP_METERS = 3500;

function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const [lat1, lon1] = [a[0], a[1]];
  const [lat2, lon2] = [b[0], b[1]];
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

function splitPathAtMaxGapMeters(
  path: LatLng[],
  maxGapMeters: number
): LatLng[][] {
  if (path.length < 2) return [];
  const runs: LatLng[][] = [];
  let cur: LatLng[] = [path[0]];
  for (let i = 1; i < path.length; i++) {
    if (haversineMeters(path[i - 1], path[i]) > maxGapMeters) {
      if (cur.length >= 2) runs.push(cur);
      cur = [path[i]];
    } else {
      cur.push(path[i]);
    }
  }
  if (cur.length >= 2) runs.push(cur);
  return runs;
}

function normalizeHeritageSegments(paths: LatLng[][]): LatLng[][] {
  const out: LatLng[][] = [];
  for (const p of paths) {
    for (const run of splitPathAtMaxGapMeters(p, MAX_HERITAGE_GAP_METERS)) {
      out.push(run);
    }
  }
  return out;
}

function distPointToSegment(p: LatLng, a: LatLng, b: LatLng): number {
  const px = p[1];
  const py = p[0];
  const ax = a[1];
  const ay = a[0];
  const bx = b[1];
  const by = b[0];
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const ab2 = abx * abx + aby * aby;
  if (ab2 < 1e-18) return dist(p, a);
  let t = (apx * abx + apy * aby) / ab2;
  t = Math.max(0, Math.min(1, t));
  const qx = ax + t * abx;
  const qy = ay + t * aby;
  const dlat = py - qy;
  const dlng = px - qx;
  return Math.sqrt(dlat * dlat + dlng * dlng);
}

function minDistancePointToPolyline(p: LatLng, path: LatLng[]): number {
  if (path.length === 0) return Number.POSITIVE_INFINITY;
  if (path.length === 1) return dist(p, path[0]);
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < path.length - 1; i++) {
    const d = distPointToSegment(p, path[i], path[i + 1]);
    if (d < best) best = d;
  }
  return best;
}

function closestLatLngOnSegment(p: LatLng, a: LatLng, b: LatLng): LatLng {
  const px = p[1];
  const py = p[0];
  const ax = a[1];
  const ay = a[0];
  const bx = b[1];
  const by = b[0];
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const ab2 = abx * abx + aby * aby;
  if (ab2 < 1e-18) return [a[0], a[1]];
  let t = (apx * abx + apy * aby) / ab2;
  t = Math.max(0, Math.min(1, t));
  return [ay + t * aby, ax + t * abx];
}

function closestOnHeritage(p: LatLng, heritage: LatLng[][]): { point: LatLng; meters: number } {
  let bestM = Number.POSITIVE_INFINITY;
  let bestP: LatLng = p;
  for (const path of heritage) {
    if (path.length < 2) {
      if (path.length === 1) {
        const m = haversineMeters(p, path[0]);
        if (m < bestM) {
          bestM = m;
          bestP = path[0];
        }
      }
      continue;
    }
    for (let i = 0; i < path.length - 1; i++) {
      const q = closestLatLngOnSegment(p, path[i], path[i + 1]);
      const m = haversineMeters(p, q);
      if (m < bestM) {
        bestM = m;
        bestP = q;
      }
    }
  }
  return { point: bestP, meters: bestM };
}

function minDistancePointToHeritageMeters(p: LatLng, heritage: LatLng[][]): number {
  return closestOnHeritage(p, heritage).meters;
}

const HERITAGE_ROUTE_MERGE_M = 10;

function trimInteriorVerticesNearHeritage(
  points: LatLng[],
  heritage: LatLng[][],
  thresholdM: number
): LatLng[] {
  if (points.length <= 2) return points;
  const out: LatLng[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    if (minDistancePointToHeritageMeters(points[i], heritage) < thresholdM) continue;
    out.push(points[i]);
  }
  out.push(points[points.length - 1]);
  const dedup: LatLng[] = [];
  for (const pt of out) {
    const prev = dedup[dedup.length - 1];
    if (prev && prev[0] === pt[0] && prev[1] === pt[1]) continue;
    dedup.push(pt);
  }
  return dedup.length >= 2 ? dedup : points;
}

function mergeDetourPaintNearHeritage(
  pieces: DetourPaintPiece[],
  heritage: LatLng[][]
): DetourPaintPiece[] {
  if (heritage.length === 0) return pieces;
  const next: DetourPaintPiece[] = [];
  for (const piece of pieces) {
    if (piece.kind === "road") {
      const trimmed = trimInteriorVerticesNearHeritage(
        piece.points,
        heritage,
        HERITAGE_ROUTE_MERGE_M
      );
      next.push({
        kind: "road",
        points: trimmed.length >= 2 ? trimmed : piece.points,
      });
      continue;
    }
    next.push(piece);
  }

  for (let i = 1; i < next.length; i++) {
    const prev = next[i - 1];
    const cur = next[i];
    if (prev.kind !== "road" || cur.kind !== "offroad") continue;
    const pts = [...prev.points];
    let joint = pts[pts.length - 1];
    const snap = closestOnHeritage(joint, heritage);
    if (snap.meters <= HERITAGE_ROUTE_MERGE_M) joint = snap.point;
    pts[pts.length - 1] = joint;
    while (pts.length >= 2) {
      const a = pts[pts.length - 2];
      const b = pts[pts.length - 1];
      if (a[0] === b[0] && a[1] === b[1]) pts.pop();
      else break;
    }
    if (pts.length < 2) continue;
    const roadEnd = pts[pts.length - 1];
    next[i - 1] = { kind: "road", points: pts };
    next[i] = { kind: "offroad", roadEnd, target: cur.target };
  }

  return next;
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

export type DetourPaintPiece =
  | { kind: "road"; points: LatLng[] }
  | { kind: "offroad"; roadEnd: LatLng; target: LatLng };

export interface IntegratedRoute {
  solid: LatLng[][];
  dashed: LatLng[][];
  removed: LatLng[][];
  /** Populated when Google-routed detours split on-road geometry from direct off-network legs. */
  detourPaint?: DetourPaintPiece[];
  degradedDashedSegments: number;
}

export const OFFICIAL_NETWORK_GAP_METERS = 28;

function appendLatLngDeduped(out: LatLng[], pts: LatLng[]) {
  for (const p of pts) {
    const prev = out[out.length - 1];
    if (prev && prev[0] === p[0] && prev[1] === p[1]) continue;
    out.push(p);
  }
}

export function flattenIntegratedRouteForPersistence(route: IntegratedRoute): Array<[number, number]> {
  const flattened: LatLng[] = [];

  if (route.detourPaint && route.detourPaint.length > 0) {
    for (const piece of route.detourPaint) {
      if (piece.kind === "road") {
        appendLatLngDeduped(flattened, piece.points);
      } else {
        appendLatLngDeduped(flattened, [piece.roadEnd, piece.target]);
      }
    }
    return flattened.map(([lat, lng]) => [lat, lng] as [number, number]);
  }

  const source = route.dashed.length > 0 ? route.dashed : route.solid;
  for (const segment of source) {
    if (flattened.length === 0) {
      appendLatLngDeduped(flattened, segment);
      continue;
    }
    if (segment.length === 0) continue;
    const [firstLat, firstLng] = segment[0];
    const last = flattened[flattened.length - 1];
    if (last[0] === firstLat && last[1] === firstLng) {
      appendLatLngDeduped(flattened, segment.slice(1));
    } else {
      appendLatLngDeduped(flattened, segment);
    }
  }
  return flattened.map(([lat, lng]) => [lat, lng] as [number, number]);
}

function buildIntegratedRouteOneSegment(
  basePath: LatLng[],
  userPoints: LatLng[]
): IntegratedRoute {
  const solid: LatLng[][] = [];
  const dashed: LatLng[][] = [];
  const removed: LatLng[][] = [];

  if (basePath.length === 0)
    return { solid, dashed, removed, degradedDashedSegments: 0 };

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

export function buildIntegratedRoute(
  basePaths: LatLng[][],
  userPoints: LatLng[]
): IntegratedRoute {
  const solid: LatLng[][] = [];
  const dashed: LatLng[][] = [];
  const removed: LatLng[][] = [];

  const segments = normalizeHeritageSegments(basePaths);
  if (segments.length === 0)
    return { solid, dashed, removed, degradedDashedSegments: 0 };

  if (userPoints.length === 0) {
    for (const s of segments) solid.push([...s]);
    return { solid, dashed, removed, degradedDashedSegments: 0 };
  }

  const pointsBySegment: LatLng[][] = segments.map(() => []);
  for (const p of userPoints) {
    let bestSi = 0;
    let bestD = Number.POSITIVE_INFINITY;
    for (let si = 0; si < segments.length; si++) {
      const d = minDistancePointToPolyline(p, segments[si]);
      if (d < bestD) {
        bestD = d;
        bestSi = si;
      }
    }
    pointsBySegment[bestSi].push(p);
  }

  for (let si = 0; si < segments.length; si++) {
    const part = buildIntegratedRouteOneSegment(
      segments[si],
      pointsBySegment[si]
    );
    solid.push(...part.solid);
    dashed.push(...part.dashed);
    removed.push(...part.removed);
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

function jitterPoint(
  point: LatLng,
  radiusMeters: number,
  bearingDegrees: number
): LatLng {
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
    const baseBearing =
      JITTER_BEARINGS_DEGREES[legIndex % JITTER_BEARINGS_DEGREES.length];
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
): Promise<{ detourPaint: DetourPaintPiece[]; degradedDashedSegments: number }> {
  const detourPaint: DetourPaintPiece[] = [];

  for (const segment of dashedSegments) {
    if (segment.length < 2) continue;

    let bucket: LatLng[] = [];

    const flushBucket = () => {
      if (bucket.length >= 2) {
        detourPaint.push({ kind: "road", points: [...bucket] });
      }
      bucket = [];
    };

    for (let i = 0; i < segment.length - 1; i++) {
      const start = segment[i];
      const end = segment[i + 1];
      const leg = await buildGoogleLegWithRetries(start, end, i, computeRoute);

      if (bucket.length === 0) {
        bucket.push(...leg);
      } else {
        bucket.push(...leg.slice(1));
      }

      const roadEnd = leg[leg.length - 1];
      if (haversineMeters(roadEnd, end) > OFFICIAL_NETWORK_GAP_METERS) {
        flushBucket();
        detourPaint.push({ kind: "offroad", roadEnd, target: end });
      }
    }

    flushBucket();
  }

  return { detourPaint, degradedDashedSegments: 0 };
}

export async function buildIntegratedRouteWithGoogleDetours(
  basePaths: LatLng[][],
  userPoints: LatLng[],
  options: BuildGoogleIntegratedRouteOptions
): Promise<IntegratedRoute> {
  if (userPoints.length === 0) {
    return buildIntegratedRoute(basePaths, []);
  }

  const base = buildIntegratedRoute(basePaths, userPoints);
  if (base.dashed.length === 0) return base;

  const routed = await buildGoogleDashedSegments(base.dashed, options.computeRoute);
  const detourPaint = mergeDetourPaintNearHeritage(routed.detourPaint, base.solid);
  return {
    solid: base.solid,
    removed: base.removed,
    dashed: [],
    detourPaint,
    degradedDashedSegments: routed.degradedDashedSegments,
  };
}
