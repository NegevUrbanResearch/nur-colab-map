import type { Feature } from "geojson";
import type { LatLng, Layer, Map as LeafletMap, PathOptions } from "leaflet";

/** Map placement actions triggered from layer info popups (CTA buttons). */
export type LayerPopupCtaAction = "create_pink_node" | "create_memorial";

/**
 * Fired when the user uses a CTA in a manifest layer info popup. Coordinates are the popup anchor
 * (the user’s click on the feature / tile), matching Leaflet’s placement for that interaction.
 */
export type OnLayerPopupMapAction = (args: { action: LayerPopupCtaAction; lat: number; lng: number }) => void;

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
   * When true, GeoJSON features receive pointer events. When false, never interactive. When omitted,
   * `loadGeoJsonLayer` defaults to interactive iff `ui` declares `popup.fields` (see
   * `layerUiDeclaresPopupFields`); otherwise non-interactive so bare overlays do not swallow map clicks.
   * When PMTiles was attempted and `loadLayerIntoMap` falls back to GeoJSON, omitted becomes `true`
   * unless explicitly set to `false`.
   */
  geojsonInteractive?: boolean;
  /**
   * When false, skips the PMTiles click → `queryTileFeaturesDebug` popup bridge. When omitted and
   * `ui.popup.fields` is set, the PMTiles grid is interactive and opens the same popup model as GeoJSON.
   */
  pmtilesInteractive?: boolean;
  /**
   * When set, the layer info popup (GeoJSON and PMTiles) includes CTA button(s) that call this with
   * the clicked-anchored lat/lng. The host map uses this to start pink-line or memorial placement.
   */
  onPopupAction?: OnLayerPopupMapAction;
  /**
   * If set, each popup open / click resolves the active map mode so the correct single CTA is shown
   * (node vs memorial). Prefer this over a static CTA so toggling the map mode updates the button.
   */
  getLayerPopupCtaMode?: () => "pink" | "memorial";
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
  /** Vector source layer name inside the PMTiles archive (paint rule `dataLayer`). Defaults to `"layer"` when omitted. */
  pmtilesSourceLayer?: string;
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
