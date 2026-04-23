import type { LayerManifestEntry } from "./types";
import {
  OCTOBER_7TH_PACK_ID,
  october7thFamilyRowId,
  october7thMergedFamilyLabel,
  type October7thMergedFamilyKey,
} from "./layerDisplayGlossary";

export function packLayerKey(packId: string, layerId: string): string {
  return `${packId}::${layerId}`;
}

export function isOctober7thPack(packId: string): boolean {
  return packId === OCTOBER_7TH_PACK_ID;
}

/**
 * Maps a concrete layer id to its merged display family when it belongs to a
 * geometry-variant group (October 7 pack only).
 */
export function october7thMergedFamilyKeyFromLayerId(layerId: string): October7thMergedFamilyKey | null {
  if (layerId.startsWith("חדירה_לישוב")) return "חדירה_לישוב";
  if (layerId.startsWith("מאבק_וגבורה")) return "מאבק_וגבורה";
  if (layerId.startsWith("פגיעה_נקודתית")) return "פגיעה_נקודתית";
  return null;
}

export type LayerTileRow =
  | { kind: "layer"; layer: LayerManifestEntry }
  | {
      kind: "family";
      familyKey: October7thMergedFamilyKey;
      label: string;
      members: LayerManifestEntry[];
    };

/** Focused-pack tiles: one row per layer, except October 7 families merge by first manifest occurrence order. */
export function buildLayerTileRows(packId: string, layers: LayerManifestEntry[]): LayerTileRow[] {
  if (!isOctober7thPack(packId)) {
    return layers.map((layer) => ({ kind: "layer" as const, layer }));
  }
  const seen = new Set<October7thMergedFamilyKey>();
  const out: LayerTileRow[] = [];
  for (const layer of layers) {
    const fam = october7thMergedFamilyKeyFromLayerId(layer.id);
    if (fam) {
      if (seen.has(fam)) continue;
      seen.add(fam);
      const members = layers.filter((l) => october7thMergedFamilyKeyFromLayerId(l.id) === fam);
      out.push({
        kind: "family",
        familyKey: fam,
        label: october7thMergedFamilyLabel(fam),
        members,
      });
    } else {
      out.push({ kind: "layer", layer });
    }
  }
  return out;
}

export type LegendActiveRow = { id: string; label: string; detail?: string };

/** Legend rows for October 7 when only some layers are active (dedupe by family). */
export function buildOctober7thActiveLegendRows(
  packId: string,
  layers: LayerManifestEntry[],
  layerOnByKey: Record<string, boolean>
): LegendActiveRow[] {
  const seenFamilies = new Set<October7thMergedFamilyKey>();
  const rows: LegendActiveRow[] = [];
  for (const layer of layers) {
    if (layerOnByKey[packLayerKey(packId, layer.id)] !== true) continue;
    const fam = october7thMergedFamilyKeyFromLayerId(layer.id);
    if (fam) {
      if (seenFamilies.has(fam)) continue;
      seenFamilies.add(fam);
      rows.push({
        id: october7thFamilyRowId(packId, fam),
        label: october7thMergedFamilyLabel(fam),
      });
    } else {
      rows.push({
        id: packLayerKey(packId, layer.id),
        label: layer.name,
      });
    }
  }
  return rows;
}
