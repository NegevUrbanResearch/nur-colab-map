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
