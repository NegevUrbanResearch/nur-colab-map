import type { LegendModelRow, LegendSwatchPreview } from "./legend/legendTypes";
import type { LayerManifestEntry, LayerPackStylesJson } from "./types";
import { legendSwatchFromStyle } from "./legend/legendSwatchFromStyle";
import {
  OCTOBER_7TH_PACK_ID,
  normalizeLegendFallbackLabel,
  october7thFamilyRowId,
  october7thMergedFamilyLabel,
  type October7thMergedFamilyKey,
} from "./layerDisplayGlossary";

export function packLayerKey(packId: string, layerId: string): string {
  return `${packId}::${layerId}`;
}

const PACK_LAYER_SEP = "::";

/** Inverse of `packLayerKey` when `layerId` does not contain the separator (true for all pack layers). */
export function parsePackLayerKey(key: string): { packId: string; layerId: string } | null {
  const i = key.indexOf(PACK_LAYER_SEP);
  if (i <= 0) return null;
  return { packId: key.slice(0, i), layerId: key.slice(i + PACK_LAYER_SEP.length) };
}

export function isOctober7thPack(packId: string): boolean {
  return packId === OCTOBER_7TH_PACK_ID;
}

/** Lower = preferred for a merged family legend swatch (among active members). */
function october7thGeometrySwatchPriority(geometryType: string): number {
  const t = geometryType.toLowerCase();
  if (t === "point" || t === "multipoint") return 0;
  if (t === "line" || t === "linestring" || t === "multilinestring") return 1;
  if (t === "polygon" || t === "multipolygon") return 2;
  return 3;
}

/** Maps manifest geometry to legend swatch kind; null if unknown. */
function october7thGeometryLegendKind(geometryType: string): "point" | "line" | "polygon" | null {
  const p = october7thGeometrySwatchPriority(geometryType);
  if (p === 0) return "point";
  if (p === 1) return "line";
  if (p === 2) return "polygon";
  return null;
}

/**
 * All manifest layers that belong to a merged October 7 display family (same logic as layer tiles).
 */
export function october7thManifestMembersForFamilyKey(
  layers: LayerManifestEntry[],
  familyKey: October7thMergedFamilyKey,
): LayerManifestEntry[] {
  return layers.filter((l) => october7thMergedFamilyKeyFromLayerId(l.id) === familyKey);
}

/**
 * One swatch per geometry kind for active family members (deduped), in point → line → polygon order.
 */
export function buildOctober7thFamilyMultiSwatches(
  activeFamilyMembers: LayerManifestEntry[],
  manifestLayers: LayerManifestEntry[],
  styles: LayerPackStylesJson,
): LegendSwatchPreview[] {
  const orderIndex = new Map(manifestLayers.map((l, i) => [l.id, i] as const));
  const bestByKind = new Map<"point" | "line" | "polygon", LayerManifestEntry>();
  for (const m of activeFamilyMembers) {
    const kind = october7thGeometryLegendKind(m.geometryType);
    if (!kind) continue;
    const prev = bestByKind.get(kind);
    if (!prev || (orderIndex.get(m.id) ?? 0) < (orderIndex.get(prev.id) ?? 0)) {
      bestByKind.set(kind, m);
    }
  }
  const out: LegendSwatchPreview[] = [];
  for (const kind of ["point", "line", "polygon"] as const) {
    const member = bestByKind.get(kind);
    if (!member) continue;
    const sw = legendSwatchFromStyle(styles[member.id], member.geometryType);
    if (sw) out.push(sw);
  }
  return out;
}

/**
 * Picks which active member’s style should drive the merged family legend swatch: point over line
 * over polygon, then manifest order for ties (not “first active in manifest” alone).
 */
export function pickOctober7thFamilyLayerForSwatch(
  activeFamilyMembers: LayerManifestEntry[],
  manifestLayers: LayerManifestEntry[],
): LayerManifestEntry {
  const orderIndex = new Map(manifestLayers.map((l, i) => [l.id, i] as const));
  return [...activeFamilyMembers].sort((a, b) => {
    const ra = october7thGeometrySwatchPriority(a.geometryType);
    const rb = october7thGeometrySwatchPriority(b.geometryType);
    if (ra !== rb) return ra - rb;
    return (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0);
  })[0]!;
}

const OCTOBER7_GEO_SUFFIXES = ["-אזור", "-נקודה", "-ציר"] as const;

function stripOctober7GeometrySuffix(layerId: string): string {
  for (const suf of OCTOBER7_GEO_SUFFIXES) {
    if (layerId.endsWith(suf)) return layerId.slice(0, -suf.length);
  }
  return layerId;
}

/**
 * Maps a concrete layer id to its merged display family when it belongs to a
 * geometry-variant group (October 7 pack only).
 */
export function october7thMergedFamilyKeyFromLayerId(layerId: string): October7thMergedFamilyKey | null {
  if (layerId.startsWith("חדירה_לישוב")) return "חדירה_לישוב";
  if (layerId.startsWith("מאבק_וגבורה")) return "מאבק_וגבורה";
  if (layerId.startsWith("פגיעה_נקודתית")) return "פגיעה_נקודתית";
  if (layerId.startsWith("ביזה-")) return "ביזה";
  if (layerId.startsWith("אזור_הרס-")) return "אזור_הרס";
  if (layerId.startsWith("אירוע_נקודתי-")) {
    return stripOctober7GeometrySuffix(layerId) as October7thMergedFamilyKey;
  }
  return null;
}

export type LayerTileRow =
  | { kind: "layer"; layer: LayerManifestEntry; label: string }
  | {
      kind: "family";
      mergedFamily: October7thMergedFamilyKey;
      label: string;
      members: LayerManifestEntry[];
    };

/** Focused-pack tiles: one row per layer, except October 7 families merge by first manifest occurrence order. */
export function buildLayerTileRows(packId: string, layers: LayerManifestEntry[]): LayerTileRow[] {
  if (!isOctober7thPack(packId)) {
    return layers.map((layer) => ({
      kind: "layer" as const,
      layer,
      label: normalizeLegendFallbackLabel(layer.name),
    }));
  }
  const seen = new Set<October7thMergedFamilyKey>();
  const out: LayerTileRow[] = [];
  for (const layer of layers) {
    const fam = october7thMergedFamilyKeyFromLayerId(layer.id);
    if (fam) {
      if (seen.has(fam)) continue;
      seen.add(fam);
      const members = october7thManifestMembersForFamilyKey(layers, fam);
      out.push({
        kind: "family",
        mergedFamily: fam,
        label: october7thMergedFamilyLabel(fam),
        members,
      });
    } else {
      out.push({
        kind: "layer",
        layer,
        label: normalizeLegendFallbackLabel(layer.name),
      });
    }
  }
  return out;
}

/** Legend rows for October 7 when only some layers are active (dedupe by family). */
export function buildOctober7thActiveLegendRows(
  packId: string,
  layers: LayerManifestEntry[],
  layerOnByKey: Record<string, boolean>,
  styles: LayerPackStylesJson,
): LegendModelRow[] {
  const seenFamilies = new Set<October7thMergedFamilyKey>();
  const rows: LegendModelRow[] = [];
  for (const layer of layers) {
    if (layerOnByKey[packLayerKey(packId, layer.id)] !== true) continue;
    const fam = october7thMergedFamilyKeyFromLayerId(layer.id);
    if (fam) {
      if (seenFamilies.has(fam)) continue;
      seenFamilies.add(fam);
      const activeFamilyMembers = october7thManifestMembersForFamilyKey(layers, fam).filter(
        (l) => layerOnByKey[packLayerKey(packId, l.id)] === true,
      );
      const source =
        activeFamilyMembers.length > 0
          ? pickOctober7thFamilyLayerForSwatch(activeFamilyMembers, layers)
          : undefined;
      const famSwatch =
        source != null ? legendSwatchFromStyle(styles[source.id], source.geometryType) : undefined;
      const multiSwatches = buildOctober7thFamilyMultiSwatches(activeFamilyMembers, layers, styles);
      rows.push({
        id: october7thFamilyRowId(packId, fam),
        label: october7thMergedFamilyLabel(fam),
        ...(famSwatch != null ? { swatch: famSwatch } : {}),
        ...(multiSwatches.length > 1 ? { swatches: multiSwatches } : {}),
      });
    } else {
      const swatch = legendSwatchFromStyle(styles[layer.id], layer.geometryType);
      rows.push({
        id: packLayerKey(packId, layer.id),
        label: normalizeLegendFallbackLabel(layer.name),
        ...(swatch != null ? { swatch } : {}),
      });
    }
  }
  return rows;
}

/** Virtual tile rows for pack UI (October 7 merges geometry-variant families into one row each). */
export function countMergedPackTileRows(packId: string, layers: LayerManifestEntry[]): number {
  return buildLayerTileRows(packId, layers).length;
}

/**
 * How many of those virtual rows are fully on (single layer on, or merged family with every member on).
 * Matches chip `n` when `total` is `countMergedPackTileRows` for the same pack.
 */
export function countMergedPackFullyActiveTileRows(
  packId: string,
  layers: LayerManifestEntry[],
  layerOnByKey: Record<string, boolean>,
): number {
  const isOn = (layerId: string) => layerOnByKey[packLayerKey(packId, layerId)] === true;
  let n = 0;
  for (const row of buildLayerTileRows(packId, layers)) {
    if (row.kind === "layer") {
      if (isOn(row.layer.id)) n += 1;
    } else if (row.members.length > 0 && row.members.every((m) => isOn(m.id))) {
      n += 1;
    }
  }
  return n;
}
