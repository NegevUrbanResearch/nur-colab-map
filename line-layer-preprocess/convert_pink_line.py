"""
Convert pink-line.geojson from EPSG:2039 (Israeli TM) to WGS84 and build
one continuous LineString for use in the app.
"""

import json
from pathlib import Path
from typing import List

from pyproj import Transformer

SCRIPT_DIR = Path(__file__).resolve().parent
INPUT_PATH = SCRIPT_DIR / "pink-line.geojson"
OUTPUT_PATH = SCRIPT_DIR.parent / "public" / "line-layer" / "pink-line-wgs84.geojson"

# Israeli TM (EPSG:2039) -> WGS84 (EPSG:4326). GeoJSON coords are (easting, northing).
transformer = Transformer.from_crs("EPSG:2039", "EPSG:4326", always_xy=True)


def transform_ring(ring):
    """Transform a list of [x, y] (easting, northing) to [lng, lat]."""
    return [list(transformer.transform(x, y)) for x, y in ring]


def collect_segments(features) -> List[List[List[float]]]:
    """Collect all LineString segments from the source features in WGS84."""
    segments: List[List[List[float]]] = []
    for feature in features:
        geom = feature.get("geometry") or {}
        gtype = geom.get("type")
        coords = geom.get("coordinates") or []

        if gtype == "LineString":
            if coords:
                segments.append(transform_ring(coords))
        elif gtype == "MultiLineString":
            for ring in coords:
                if ring:
                    segments.append(transform_ring(ring))
    return segments


def path_length(coords: List[List[float]]) -> float:
    """Sum of Euclidean distances between consecutive points."""
    total = 0.0
    for i in range(len(coords) - 1):
        a, b = coords[i], coords[i + 1]
        total += ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) ** 0.5
    return total


def connect_segments(segments: List[List[List[float]]]) -> List[List[float]]:
    """
    Connect segments into a single continuous path. Tries each segment as
    start and greedily attaches nearest remaining segment; returns the
    ordering that minimizes total path length (including connection gaps).
    """
    if not segments:
        return []
    if len(segments) == 1:
        return segments[0][:]

    def build_path_from_start(start_idx: int, start_reversed: bool) -> List[List[float]]:
        remaining = [s[:] for i, s in enumerate(segments) if i != start_idx]
        seg = segments[start_idx][:]
        if start_reversed:
            seg = list(reversed(seg))
        path = seg[:]
        while remaining:
            end_lng, end_lat = path[-1]
            best_idx = None
            best_reverse = False
            best_dist_sq = float("inf")
            for idx, s in enumerate(remaining):
                d_start = (end_lng - s[0][0]) ** 2 + (end_lat - s[0][1]) ** 2
                d_end = (end_lng - s[-1][0]) ** 2 + (end_lat - s[-1][1]) ** 2
                if d_start < best_dist_sq:
                    best_dist_sq, best_idx, best_reverse = d_start, idx, False
                if d_end < best_dist_sq:
                    best_dist_sq, best_idx, best_reverse = d_end, idx, True
            s = remaining.pop(best_idx)
            if best_reverse:
                s = list(reversed(s))
            path.extend(s[1:])
        return path

    best_path: List[List[float]] = []
    best_len = float("inf")
    for i in range(len(segments)):
        for rev in (False, True):
            path = build_path_from_start(i, rev)
            length = path_length(path)
            if length < best_len:
                best_len = length
                best_path = path
    return best_path


def main():
    with open(INPUT_PATH, encoding="utf-8") as f:
        data = json.load(f)

    segments = collect_segments(data.get("features", []))
    continuous_path = connect_segments(segments)

    out_feature = {
        "type": "Feature",
        "geometry": {
            "type": "LineString",
            "coordinates": continuous_path,
        },
        "properties": {},
    }

    out = {
        "type": "FeatureCollection",
        "features": [out_feature],
    }

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))

    print(f"Wrote {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
