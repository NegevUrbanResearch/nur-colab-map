import { layerDataBasename } from "./layerAssetResolution";
import type { LayerManifestEntry, LayerSourceUrls } from "./types";

const packDataUrlByBasename = (() => {
  const raw = import.meta.glob<string>("../../assets/layers/**/*.{geojson,pmtiles}", {
    eager: true,
    query: "?url",
    import: "default",
  });
  const byPack = new Map<string, Map<string, string>>();
  for (const [path, url] of Object.entries(raw)) {
    const normalized = path.replace(/\\/g, "/");
    const m = normalized.match(/layers\/([^/]+)\/(.+)$/);
    if (!m) continue;
    const packFolder = m[1]!;
    const rel = m[2]!;
    const base = (rel.split("/").pop() ?? "").normalize("NFC");
    if (!base) continue;
    if (!byPack.has(packFolder)) byPack.set(packFolder, new Map());
    byPack.get(packFolder)!.set(base, url);
  }
  return byPack;
})();

/**
 * Resolves Vite-built URLs for a manifest layer. `packFolderId` must match the assets folder name
 * (same as registry pack `id` when pack id guard passes).
 */
export function resolveLayerSourceUrls(packFolderId: string, layer: LayerManifestEntry): LayerSourceUrls | null {
  const urls = packDataUrlByBasename.get(packFolderId);
  if (!urls) return null;

  const geoBase = layerDataBasename(layer.file);
  const pmBase = layerDataBasename(layer.pmtilesFile ?? "");

  const geojsonUrl = geoBase ? urls.get(geoBase.normalize("NFC")) : undefined;
  const pmtilesUrl = pmBase ? urls.get(pmBase.normalize("NFC")) : undefined;

  if (!geojsonUrl && !pmtilesUrl) return null;

  return { pmtilesUrl, geojsonUrl };
}
