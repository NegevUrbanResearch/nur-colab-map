import { getLayerAssetBasenamesByPackId, getManifestLoadersByPackId, getStylesLoadersByPackId } from "./assetIndex";
import { layerPackDisplayNameHe } from "./layerDisplayGlossary";
import { layerManifestEntryIsResolvable } from "./layerAssetResolution";
import { warnIfPackFolderIdMismatchesManifest } from "./packIdGuard";
import type {
  LayerManifestEntry,
  LayerPackManifest,
  LayerPackStylesJson,
  LayerRegistry,
  LayerRegistryPack,
} from "./types";

function filterStylesToLayerIds(styles: LayerPackStylesJson, layerIds: Set<string>): LayerPackStylesJson {
  return Object.fromEntries(Object.entries(styles).filter(([id]) => layerIds.has(id))) as LayerPackStylesJson;
}

export async function buildLayerRegistry(): Promise<LayerRegistry> {
  const manifestLoaders = getManifestLoadersByPackId();
  const stylesLoaders = getStylesLoadersByPackId();
  const basenamesByPack = getLayerAssetBasenamesByPackId();
  const packIds = [...manifestLoaders.keys()].sort();

  const packs: LayerRegistryPack[] = [];
  for (const folderId of packIds) {
    const loadManifest = manifestLoaders.get(folderId);
    if (!loadManifest) continue;

    const manifest = (await loadManifest()).default;
    warnIfPackFolderIdMismatchesManifest(folderId, manifest);
    const loadStyles = stylesLoaders.get(folderId);
    const rawStyles: LayerPackStylesJson = loadStyles ? (await loadStyles()).default : {};

    const dataNames = basenamesByPack.get(folderId) ?? new Set<string>();
    const keptLayers: LayerManifestEntry[] = [];
    for (const layer of manifest.layers) {
      if (layerManifestEntryIsResolvable(layer, dataNames)) {
        keptLayers.push(layer);
        continue;
      }
      if (import.meta.env.DEV && import.meta.env.MODE !== "test") {
        console.warn(
          `[layerRegistry] Skipping unresolvable layer (no matching file in src/assets/layers/${folderId}/): pack=${folderId} layer=${layer.id} file=${layer.file} pmtilesFile=${layer.pmtilesFile ?? ""}`,
        );
      }
    }

    if (keptLayers.length === 0) {
      if (import.meta.env.DEV && import.meta.env.MODE !== "test") {
        console.warn(
          `[layerRegistry] Skipping pack "${folderId}": no layers with resolvable data files (check manifest vs on-disk names).`,
        );
      }
      continue;
    }

    const layerIds = new Set(keptLayers.map((l) => l.id));
    const styles = filterStylesToLayerIds(rawStyles, layerIds);
    const filteredManifest: LayerPackManifest = { ...manifest, layers: keptLayers };

    packs.push({
      id: manifest.id,
      name: manifest.name,
      displayName: layerPackDisplayNameHe(manifest.id, manifest),
      manifest: filteredManifest,
      styles,
    });
  }

  const getLayer = (packId: string, layerId: string): LayerManifestEntry | undefined => {
    const pack = packs.find((p) => p.id === packId);
    return pack?.manifest.layers.find((l) => l.id === layerId);
  };

  return { packs, getLayer };
}
