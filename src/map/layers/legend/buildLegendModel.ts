import { OCTOBER_7TH_PACK_ID } from "../layerDisplayGlossary";
import { buildOctober7thActiveLegendRows, packLayerKey } from "../layerNameUtils";
import type { LayerManifestEntry, LayerRegistry } from "../types";

export type LegendModelRow = { id: string; label: string; detail?: string };

export type LegendModelGroup = {
  packId: string;
  packName: string;
  rows: LegendModelRow[];
};

export type LegendModel = {
  groups: LegendModelGroup[];
};

function rowsForDefaultPack(layers: LayerManifestEntry[], packId: string, layerOnByKey: Record<string, boolean>): LegendModelRow[] {
  const rows: LegendModelRow[] = [];
  for (const layer of layers) {
    if (layerOnByKey[packLayerKey(packId, layer.id)] !== true) continue;
    rows.push({
      id: packLayerKey(packId, layer.id),
      label: layer.name,
    });
  }
  return rows;
}

export function buildLegendModel(registry: LayerRegistry, layerOnByKey: Record<string, boolean>): LegendModel {
  const groups: LegendModelGroup[] = [];
  for (const pack of registry.packs) {
    const rows =
      pack.id === OCTOBER_7TH_PACK_ID
        ? buildOctober7thActiveLegendRows(pack.id, pack.manifest.layers, layerOnByKey)
        : rowsForDefaultPack(pack.manifest.layers, pack.id, layerOnByKey);
    if (rows.length === 0) continue;
    groups.push({
      packId: pack.id,
      packName: pack.name,
      rows,
    });
  }
  return { groups };
}
