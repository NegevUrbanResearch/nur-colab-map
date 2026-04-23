import { getManifestLoadersByPackId, getStylesLoadersByPackId } from "./assetIndex";
import type { LayerManifestEntry, LayerRegistry, LayerRegistryPack } from "./types";

export async function buildLayerRegistry(): Promise<LayerRegistry> {
  const manifestLoaders = getManifestLoadersByPackId();
  const stylesLoaders = getStylesLoadersByPackId();
  const packIds = [...manifestLoaders.keys()].sort();

  const packs: LayerRegistryPack[] = [];
  for (const folderId of packIds) {
    const loadManifest = manifestLoaders.get(folderId);
    if (!loadManifest) continue;

    const manifest = (await loadManifest()).default;
    const loadStyles = stylesLoaders.get(folderId);
    const styles = loadStyles ? (await loadStyles()).default : {};

    packs.push({
      id: manifest.id,
      name: manifest.name,
      manifest,
      styles,
    });
  }

  const getLayer = (packId: string, layerId: string): LayerManifestEntry | undefined => {
    const pack = packs.find((p) => p.id === packId);
    return pack?.manifest.layers.find((l) => l.id === layerId);
  };

  return { packs, getLayer };
}
