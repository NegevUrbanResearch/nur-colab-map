import type { Feature } from "geojson";
import L from "leaflet";
import type { PathOptions } from "leaflet";
import parkingIconUrl from "../../assets/layers/future_development/parking-icon.png?url";
import { cityscopeGeometryKind, parseDefaultSymbolFromStyle, type ParsedMarker } from "./cityscopeSymbolParse";
import { packLineStrokePaintFromParsed, packPolygonOutlineWidthFromParsed } from "./styleToLeaflet";
import type { LayerManifestEntry } from "./types";

type GeojsonPackAdapter = {
  geojsonStyle?: PathOptions | ((feature?: Feature) => PathOptions);
  geojsonPointToLayer?: (feature: Feature, latlng: L.LatLng) => L.Layer;
};

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
export function geojsonAdapterFromPackStyle(style: unknown, layer: LayerManifestEntry): GeojsonPackAdapter {
  const parsed = parseDefaultSymbolFromStyle(style);
  const g = layer.geometryType.toLowerCase();
  const sk = cityscopeGeometryKind(style);

  const lineFromPack = (): GeojsonPackAdapter | undefined => {
    if (!parsed?.stroke) return undefined;
    const paint = packLineStrokePaintFromParsed(parsed.stroke, {
      color: "#3388ff",
      weight: 2,
      opacity: 1,
    });
    return {
      geojsonStyle: {
        color: paint.color,
        weight: paint.weight,
        opacity: paint.opacity,
        dashArray: paint.dash,
      },
    };
  };

  const pointFromPack = (): GeojsonPackAdapter | undefined => {
    if (!parsed?.marker) return undefined;
    const m = parsed.marker;
    return {
      geojsonPointToLayer: (_f, latlng) => pointFeatureToLayer(m, layer, latlng),
    };
  };

  const polygonFromPack = (): GeojsonPackAdapter | undefined => {
    if (!(parsed?.fill || parsed?.stroke)) return undefined;
    const f = parsed.fill;
    const s = parsed.stroke;
    return {
      geojsonStyle: {
        fillColor: f?.color,
        fillOpacity: f?.opacity ?? 0.35,
        color: s?.color ?? f?.color ?? "#000000",
        weight: packPolygonOutlineWidthFromParsed(s),
        opacity: s?.opacity ?? 1,
      },
    };
  };

  if (g === "point") {
    const r = pointFromPack();
    if (r) return r;
  } else if (g === "line") {
    const r = lineFromPack();
    if (r) return r;
  } else if (g === "polygon") {
    const r = polygonFromPack();
    if (r) return r;
  }

  if (sk === "line") {
    const r = lineFromPack();
    if (r) return r;
  }
  if (sk === "point") {
    const r = pointFromPack();
    if (r) return r;
  }
  if (sk === "polygon") {
    const r = polygonFromPack();
    if (r) return r;
  }

  return {};
}
