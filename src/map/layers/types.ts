import type { Feature } from "geojson";
import type { LatLng, Layer, Map as LeafletMap, PathOptions } from "leaflet";

/** Resolved URLs for a single manifest layer (PMTiles preferred when present). */
export type LayerSourceUrls = {
  pmtilesUrl?: string;
  geojsonUrl?: string;
};

/** Arguments for loading one overlay into a Leaflet map (orchestrator + leaf loaders). */
export type LoadLayerArgs = {
  map: LeafletMap;
  urls: LayerSourceUrls;
  /** Vector tile source layer name inside PMTiles (paint rule `dataLayer`). */
  pmtilesSourceLayer?: string;
  /** Cityscope-style style JSON blob for the layer (used by PMTiles path). */
  style?: unknown;
  /** Manifest `ui` fragment (e.g. popup field list). */
  ui?: unknown;
  /** Manifest `geometryType` — steers PMTiles paint rules (line vs polygon). */
  layerGeometryType?: string;
  /** Optional Leaflet GeoJSON path options or per-feature style function. */
  geojsonStyle?: PathOptions | ((feature?: Feature) => PathOptions);
  /** When set, point features render with this factory instead of default markers. */
  geojsonPointToLayer?: (feature: Feature, latlng: LatLng) => Layer;
  /**
   * When true, GeoJSON features receive pointer events (popups/clicks). Default false so overlays
   * do not swallow map clicks (placement editing). Omit or false for PMTiles → GeoJSON fallback.
   */
  geojsonInteractive?: boolean;
};

export type LoadedLayer = {
  mode: "pmtiles" | "geojson";
  layer: Layer;
};

/** Parsed `manifest.json` for a layer pack folder under `src/assets/layers`. */
export type LayerPackManifest = {
  id: string;
  name: string;
  layers: LayerManifestEntry[];
};

export type LayerManifestEntry = {
  id: string;
  name: string;
  file: string;
  format: string;
  geometryType: string;
  pmtilesFile?: string;
  ui?: unknown;
};

/** Parsed `styles.json`: layer id -> style definition (cityscope-style JSON). */
export type LayerPackStylesJson = Record<string, unknown>;

export type LayerRegistryPack = {
  id: string;
  name: string;
  /** Hebrew (or other) label for strip + legend; `id` and `name` stay stable. */
  displayName: string;
  manifest: LayerPackManifest;
  styles: LayerPackStylesJson;
};

export type LayerRegistry = {
  packs: LayerRegistryPack[];
  getLayer: (packId: string, layerId: string) => LayerManifestEntry | undefined;
};
