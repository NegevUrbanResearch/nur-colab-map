import { describe, expect, it } from "vitest";
import {
  COLAB_ROUTE_GEOMETRY_EXPORT_VERSION,
  serializeIntegratedRouteToColabBundle,
} from "./colabRouteGeometryExport";
import type { IntegratedRoute } from "./pinkLineRoute";

describe("serializeIntegratedRouteToColabBundle", () => {
  it("maps LatLng to GeoJSON lng/lat and splits detourPaint kinds", () => {
    const route: IntegratedRoute = {
      solid: [
        [
          [32.0, 34.9],
          [32.001, 34.901],
        ],
      ],
      dashed: [],
      removed: [
        [
          [32.01, 34.91],
          [32.02, 34.92],
        ],
      ],
      detourPaint: [
        {
          kind: "road",
          points: [
            [32.1, 35.0],
            [32.11, 35.01],
          ],
        },
        {
          kind: "offroad",
          roadEnd: [32.11, 35.01],
          target: [32.2, 35.1],
        },
      ],
      degradedDashedSegments: 0,
    };

    const bundle = serializeIntegratedRouteToColabBundle(route);

    expect(bundle.detour_export_version).toBe(COLAB_ROUTE_GEOMETRY_EXPORT_VERSION);
    expect(bundle.integrated_route.solid[0]!.coordinates[0]).toEqual([34.9, 32.0]);
    expect(bundle.integrated_route.removed[0]!.coordinates[0]).toEqual([34.91, 32.01]);
    expect(bundle.detour_paint.road[0]!.coordinates[0]).toEqual([35.0, 32.1]);
    expect(bundle.detour_paint.offroad[0]!.road_end).toEqual([35.01, 32.11]);
    expect(bundle.detour_paint.offroad[0]!.target).toEqual([35.1, 32.2]);
    expect(bundle.detour_paint.junctions).toEqual([[35.01, 32.11]]);
  });

  it("uses dashed road legs when detourPaint is empty", () => {
    const route: IntegratedRoute = {
      solid: [],
      dashed: [
        [
          [32.0, 35.0],
          [32.1, 35.1],
        ],
      ],
      removed: [],
      degradedDashedSegments: 0,
    };
    const bundle = serializeIntegratedRouteToColabBundle(route);
    expect(bundle.detour_paint.road).toHaveLength(1);
    expect(bundle.detour_paint.offroad).toHaveLength(0);
    expect(bundle.detour_paint.junctions).toEqual([]);
  });
});
