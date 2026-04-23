import type { Feature } from "geojson";
import L from "leaflet";
import type { PathOptions } from "leaflet";
import parkingIconUrl from "../../assets/layers/future_development/parking-icon.png?url";
import {
  cityscopeGeometryKind,
  parseDefaultSymbolFromStyle,
  type ParsedMarker,
  type ParsedStroke,
} from "./cityscopeSymbolParse";
import { resolveStyleForFeature, type ResolvedSymbolLayers } from "./cityscopeStyleResolver";
import { packLineStrokePaintFromParsed, packPolygonOutlineWidthFromParsed } from "./styleToLeaflet";
import type { LayerManifestEntry } from "./types";

type GeojsonPackAdapter = {
  geojsonStyle?: PathOptions | ((feature?: Feature) => PathOptions);
  geojsonPointToLayer?: (feature: Feature, latlng: L.LatLng) => L.Layer;
};

const PARKING_LOTS_GEOJSON = "parking-lots.geojson";

function isRecord(x: unknown): x is Record<string, unknown> {
  return x != null && typeof x === "object";
}

function featureProperties(feature?: Feature): Record<string, unknown> {
  const p = feature?.properties;
  if (p && typeof p === "object" && !Array.isArray(p)) return p as Record<string, unknown>;
  return {};
}

function packDeclaresUniqueValue(style: unknown): boolean {
  if (!isRecord(style) || style.renderer !== "uniqueValue") return false;
  const uv = style.uniqueValues;
  return isRecord(uv) && Array.isArray(uv.classes);
}

function resolvedStrokeToParsed(
  s: ResolvedSymbolLayers["strokeLayers"][number] | undefined,
): ParsedStroke | undefined {
  if (!s) return undefined;
  return { color: s.color, width: s.width, opacity: s.opacity, dash: s.dash ?? null };
}

function leafletPathFromPackStyle(
  style: unknown,
  props: Record<string, unknown>,
  kind: "line" | "polygon",
): PathOptions {
  const resolved = resolveStyleForFeature(style, props);
  if (kind === "line") {
    const stroke =
      resolvedStrokeToParsed(resolved.strokeLayers[0]) ?? parseDefaultSymbolFromStyle(style)?.stroke;
    const paint = packLineStrokePaintFromParsed(stroke, {
      color: "#3388ff",
      weight: 2,
      opacity: 1,
    });
    return {
      color: paint.color,
      weight: paint.weight,
      opacity: paint.opacity,
      dashArray: paint.dash,
    };
  }
  const f = resolved.fillLayer
    ? { color: resolved.fillLayer.color, opacity: resolved.fillLayer.opacity }
    : parseDefaultSymbolFromStyle(style)?.fill;
  const s =
    resolvedStrokeToParsed(resolved.strokeLayers[0]) ?? parseDefaultSymbolFromStyle(style)?.stroke;
  return {
    fillColor: f?.color,
    fillOpacity: f?.opacity ?? 0.35,
    color: s?.color ?? f?.color ?? "#000000",
    weight: packPolygonOutlineWidthFromParsed(s),
    opacity: s?.opacity ?? 1,
  };
}

function markerFromResolved(m: NonNullable<ResolvedSymbolLayers["markerPointLayer"]>): ParsedMarker {
  const out: ParsedMarker = {
    shape: m.shape,
    size: m.size,
    fillColor: m.fillColor,
    strokeColor: m.strokeColor,
    strokeWidth: m.strokeWidth,
  };
  if (m.iconUrl) {
    out.iconUrl = m.iconUrl;
    if (m.iconSize) out.iconSize = m.iconSize;
    if (m.iconAnchor) out.iconAnchor = m.iconAnchor;
  }
  return out;
}

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
  const uv = packDeclaresUniqueValue(style);

  const lineGate = Boolean(parsed?.stroke || uv);
  const polygonGate = Boolean(parsed?.fill || parsed?.stroke || uv);
  const pointGate = Boolean(parsed?.marker || uv);

  const lineFromPack = (): GeojsonPackAdapter | undefined => {
    if (!lineGate) return undefined;
    return {
      geojsonStyle: (feature) => leafletPathFromPackStyle(style, featureProperties(feature), "line"),
    };
  };

  const pointFromPack = (): GeojsonPackAdapter | undefined => {
    if (!pointGate) return undefined;
    return {
      geojsonPointToLayer: (feature, latlng) => {
        const r = resolveStyleForFeature(style, featureProperties(feature));
        if (r.markerPointLayer) {
          return pointFeatureToLayer(markerFromResolved(r.markerPointLayer), layer, latlng);
        }
        const fb = parseDefaultSymbolFromStyle(style)?.marker;
        if (fb) return pointFeatureToLayer(fb, layer, latlng);
        return L.circleMarker(latlng, {
          radius: 6,
          fillColor: "#3388ff",
          color: "#222222",
          weight: 1,
          opacity: 1,
          fillOpacity: 0.92,
        });
      },
    };
  };

  const polygonFromPack = (): GeojsonPackAdapter | undefined => {
    if (!polygonGate) return undefined;
    return {
      geojsonStyle: (feature) => leafletPathFromPackStyle(style, featureProperties(feature), "polygon"),
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
