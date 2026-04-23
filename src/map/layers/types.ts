import type { Feature } from "geojson";
import type { Layer, Map as LeafletMap, PathOptions } from "leaflet";

/** Resolved URLs for a single manifest layer (PMTiles preferred when present). */
export type LayerSourceUrls = {
  pmtilesUrl?: string;
  geojsonUrl: string;
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
  /** Optional Leaflet GeoJSON path options or per-feature style function. */
  geojsonStyle?: PathOptions | ((feature?: Feature) => PathOptions);
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
  manifest: LayerPackManifest;
  styles: LayerPackStylesJson;
};

export type LayerRegistry = {
  packs: LayerRegistryPack[];
  getLayer: (packId: string, layerId: string) => LayerManifestEntry | undefined;
};
