import type { LayerManifestEntry } from "./types";

/** Normalizes a manifest `file` / `pmtilesFile` value to a basename (handles accidental path segments). */
export function layerDataBasename(manifestFilename: string | undefined): string {
  if (manifestFilename == null) return "";
  const t = manifestFilename.trim();
  if (!t) return "";
  const parts = t.replace(/\\/g, "/").split("/");
  return (parts[parts.length - 1] ?? "").normalize("NFC");
}

/**
 * A manifest layer is included if at least one referenced data file exists in the pack folder
 * (GeoJSON and/or PMTiles), so PMTiles-only on disk remains valid.
 */
export function layerManifestEntryIsResolvable(
  layer: LayerManifestEntry,
  dataFilenamesInPack: Set<string>
): boolean {
  const f = layerDataBasename(layer.file);
  const p = layerDataBasename(layer.pmtilesFile);
  const hasGeo = f !== "" && dataFilenamesInPack.has(f);
  const hasPmtiles = p !== "" && dataFilenamesInPack.has(p);
  return hasGeo || hasPmtiles;
}
