import type { Feature } from "geojson";
import L from "leaflet";
import type { PathOptions } from "leaflet";
import parkingIconUrl from "../../assets/layers/future_development/parking-icon.png?url";
import { cityscopeGeometryKind, parseDefaultSymbolFromStyle, type ParsedMarker } from "./cityscopeSymbolParse";
import type { LayerManifestEntry } from "./types";

const PARKING_LOTS_GEOJSON = "parking-lots.geojson";

function effectiveIconForPointMarker(m: ParsedMarker, layer: LayerManifestEntry): string | undefined {
  if (m.iconUrl && m.iconUrl.length > 0) return m.iconUrl;
  if (layer.file === PARKING_LOTS_GEOJSON) return parkingIconUrl;
  return undefined;
}

function pointFeatureToLayer(m: ParsedMarker, layer: LayerManifestEntry, latlng: L.LatLng): L.Layer {
  const iconUrl = effectiveIconForPointMarker(m, layer);
  if (iconUrl) {
    const size = m.iconSize ?? [36, 36];
    const ax = m.iconAnchor?.[0] ?? size[0] / 2;
    const ay = m.iconAnchor?.[1] ?? size[1] / 2;
    const icon = L.icon({
      iconUrl,
      iconSize: L.point(size[0], size[1]),
      iconAnchor: L.point(ax, ay),
      popupAnchor: L.point(0, -ay),
    });
    return L.marker(latlng, { icon });
  }
  return L.circleMarker(latlng, {
    radius: Math.max(4, Math.min(12, m.size)),
    fillColor: m.fillColor,
    color: m.strokeColor,
    weight: Math.max(0.5, m.strokeWidth),
    opacity: 1,
    fillOpacity: 0.92,
  });
}

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
      geojsonPointToLayer: (_f, latlng) => pointFeatureToLayer(m, layer, latlng),
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
      geojsonPointToLayer: (_f, latlng) => pointFeatureToLayer(m, layer, latlng),
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
