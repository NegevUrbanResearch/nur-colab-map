import type { LayerPackManifest, LayerPackStylesJson } from "./types";

const manifestGlob = import.meta.glob<{ default: LayerPackManifest }>(
  "../../assets/layers/*/manifest.json",
);

const stylesGlob = import.meta.glob<{ default: LayerPackStylesJson }>(
  "../../assets/layers/*/styles.json",
);

function packIdFromManifestPath(path: string): string | null {
  const m = path.match(/layers\/([^/]+)\/manifest\.json$/);
  return m?.[1] ?? null;
}

function packIdFromStylesPath(path: string): string | null {
  const m = path.match(/layers\/([^/]+)\/styles\.json$/);
  return m?.[1] ?? null;
}

export function getManifestLoadersByPackId(): Map<
  string,
  () => Promise<{ default: LayerPackManifest }>
> {
  const map = new Map<string, () => Promise<{ default: LayerPackManifest }>>();
  for (const [path, loader] of Object.entries(manifestGlob)) {
    const id = packIdFromManifestPath(path);
    if (id) {
      map.set(id, loader as () => Promise<{ default: LayerPackManifest }>);
    }
  }
  return map;
}

export function getStylesLoadersByPackId(): Map<
  string,
  () => Promise<{ default: LayerPackStylesJson }>
> {
  const map = new Map<string, () => Promise<{ default: LayerPackStylesJson }>>();
  for (const [path, loader] of Object.entries(stylesGlob)) {
    const id = packIdFromStylesPath(path);
    if (id) {
      map.set(id, loader as () => Promise<{ default: LayerPackStylesJson }>);
    }
  }
  return map;
}

const META_BASENAMES = new Set(["manifest.json", "styles.json"]);

/** Any depth under each top-level pack folder: GeoJSON, PMTiles, images, etc. */
const packDataFilesGlob = import.meta.glob("../../assets/layers/*/**/*");

/**
 * Fills a map of pack id → set of on-disk data file basenames from Vite glob keys (e.g. `.../layers/<packId>/.../<file>`).
 * Used for tests; `getLayerAssetBasenamesByPackId` uses the real glob.
 */
export function addLayerAssetBasenamesFromGlobKeys(
  keys: string[],
  into: Map<string, Set<string>> = new Map(),
): Map<string, Set<string>> {
  for (const path of keys) {
    const normalized = path.replace(/\\/g, "/");
    const m = normalized.match(/layers\/([^/]+)\/(.+)$/);
    if (!m) continue;
    const packId = m[1]!;
    const relPath = m[2]!;
    const fileKey = (relPath.split("/").pop() ?? "").normalize("NFC");
    if (fileKey === "" || META_BASENAMES.has(fileKey)) continue;
    if (!into.has(packId)) into.set(packId, new Set());
    into.get(packId)!.add(fileKey);
  }
  return into;
}

/**
 * Per pack folder, basenames of on-disk files (GeoJSON, PMTiles, images, etc.) that can back a layer entry.
 * Includes files in nested subfolders. Excludes `manifest.json` and `styles.json` (by basename, anywhere in the tree).
 */
export function getLayerAssetBasenamesByPackId(): Map<string, Set<string>> {
  return addLayerAssetBasenamesFromGlobKeys(Object.keys(packDataFilesGlob));
}
