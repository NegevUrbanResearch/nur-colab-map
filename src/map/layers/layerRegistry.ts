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

export type BuildLayerRegistryOptions = {
  /** When set, registry diagnostics (e.g. unresolvable layer summaries) are delivered here, including under Vitest. */
  onRegistryWarn?: (message: string) => void;
};

function filterStylesToLayerIds(styles: LayerPackStylesJson, layerIds: Set<string>): LayerPackStylesJson {
  return Object.fromEntries(Object.entries(styles).filter(([id]) => layerIds.has(id))) as LayerPackStylesJson;
}

type UnresolvedLayerDetail = { layerId: string; file?: string; pmtilesFile?: string };

function formatUnresolvedPackDetail(unresolved: UnresolvedLayerDetail[]): string {
  return unresolved
    .map((u) => `${u.layerId}(file=${u.file ?? ""},pmtilesFile=${u.pmtilesFile ?? ""})`)
    .join("; ");
}

export async function buildLayerRegistry(options?: BuildLayerRegistryOptions): Promise<LayerRegistry> {
  const onRegistryWarn = options?.onRegistryWarn;
  const emitRegistryWarn = (message: string) => {
    if (onRegistryWarn) {
      onRegistryWarn(message);
      return;
    }
    if (import.meta.env.DEV && import.meta.env.MODE !== "test") {
      console.warn(message);
    }
  };

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
    const unresolvedInPack: UnresolvedLayerDetail[] = [];
    for (const layer of manifest.layers) {
      if (layerManifestEntryIsResolvable(layer, dataNames)) {
        keptLayers.push(layer);
        continue;
      }
      unresolvedInPack.push({
        layerId: layer.id,
        file: layer.file,
        pmtilesFile: layer.pmtilesFile,
      });
    }

    if (keptLayers.length === 0) {
      if (unresolvedInPack.length > 0) {
        const detail = formatUnresolvedPackDetail(unresolvedInPack);
        emitRegistryWarn(
          `[layerRegistry] Skipping pack "${folderId}": no layers with resolvable data files (${unresolvedInPack.length} unresolvable entries under src/assets/layers/${folderId}/): pack=${folderId} ${detail}`,
        );
      } else {
        emitRegistryWarn(
          `[layerRegistry] Skipping pack "${folderId}": no layers with resolvable data files (check manifest vs on-disk names).`,
        );
      }
      continue;
    }

    if (unresolvedInPack.length > 0) {
      const detail = formatUnresolvedPackDetail(unresolvedInPack);
      emitRegistryWarn(
        `[layerRegistry] Skipped ${unresolvedInPack.length} unresolvable layer(s) (no matching file in src/assets/layers/${folderId}/): pack=${folderId} ${detail}`,
      );
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
