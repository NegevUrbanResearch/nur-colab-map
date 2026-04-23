import type { Feature } from "geojson";
import L from "leaflet";
import type { PathOptions } from "leaflet";
import { cityscopeGeometryKind, parseDefaultSymbolFromStyle } from "./cityscopeSymbolParse";
import type { LayerManifestEntry } from "./types";

/**
 * Derives Leaflet GeoJSON layer options from pack style JSON + manifest geometry.
 */
export function geojsonAdapterFromPackStyle(
  style: unknown,
  layer: LayerManifestEntry,
): {
  geojsonStyle?: PathOptions | ((feature?: Feature) => PathOptions);
  geojsonPointToLayer?: (feature: Feature, latlng: L.LatLng) => L.Layer;
} {
  const parsed = parseDefaultSymbolFromStyle(style);
  const g = layer.geometryType.toLowerCase();

  if (g === "point" && parsed?.marker) {
    const m = parsed.marker;
    return {
      geojsonPointToLayer: (_f, latlng) =>
        L.circleMarker(latlng, {
          radius: Math.max(4, Math.min(12, m.size)),
          fillColor: m.fillColor,
          color: m.strokeColor,
          weight: Math.max(0.5, m.strokeWidth),
          opacity: 1,
          fillOpacity: 0.92,
        }),
    };
  }

  if (g === "line" && parsed?.stroke) {
    const s = parsed.stroke;
    const dash = s.dash?.length ? s.dash : undefined;
    return {
      geojsonStyle: {
        color: s.color,
        weight: Math.max(1, Math.min(12, s.width)),
        opacity: s.opacity,
        dashArray: dash,
      },
    };
  }

  if (g === "polygon" && (parsed?.fill || parsed?.stroke)) {
    const f = parsed.fill;
    const s = parsed.stroke;
    return {
      geojsonStyle: {
        fillColor: f?.color,
        fillOpacity: f?.opacity ?? 0.35,
        color: s?.color ?? f?.color ?? "#000000",
        weight: s ? Math.max(0.5, Math.min(6, s.width)) : 1,
        opacity: s?.opacity ?? 1,
      },
    };
  }

  const sk = cityscopeGeometryKind(style);
  if (sk === "line" && parsed?.stroke) {
    const s = parsed.stroke;
    const dash = s.dash?.length ? s.dash : undefined;
    return {
      geojsonStyle: {
        color: s.color,
        weight: Math.max(1, Math.min(12, s.width)),
        opacity: s.opacity,
        dashArray: dash,
      },
    };
  }
  if (sk === "point" && parsed?.marker) {
    const m = parsed.marker;
    return {
      geojsonPointToLayer: (_f, latlng) =>
        L.circleMarker(latlng, {
          radius: Math.max(4, Math.min(12, m.size)),
          fillColor: m.fillColor,
          color: m.strokeColor,
          weight: Math.max(0.5, m.strokeWidth),
          opacity: 1,
          fillOpacity: 0.92,
        }),
    };
  }
  if (sk === "polygon" && (parsed?.fill || parsed?.stroke)) {
    const f = parsed.fill;
    const s = parsed.stroke;
    return {
      geojsonStyle: {
        fillColor: f?.color,
        fillOpacity: f?.opacity ?? 0.35,
        color: s?.color ?? f?.color ?? "#000000",
        weight: s ? Math.max(0.5, Math.min(6, s.width)) : 1,
        opacity: s?.opacity ?? 1,
      },
    };
  }

  return {};
}
