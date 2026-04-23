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
};
