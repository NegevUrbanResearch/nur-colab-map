import { OCTOBER_7TH_PACK_ID } from "../layerDisplayGlossary";
import { buildOctober7thActiveLegendRows, packLayerKey } from "../layerNameUtils";
import type { LayerRegistry, LayerRegistryPack } from "../types";
import { legendSwatchFromStyle } from "./legendSwatchFromStyle";
import type { LegendModel, LegendModelGroup, LegendModelRow } from "./legendTypes";

export type { LegendModel, LegendModelGroup, LegendModelRow, LegendSwatchPreview } from "./legendTypes";

function rowsForDefaultPack(pack: LayerRegistryPack, layerOnByKey: Record<string, boolean>): LegendModelRow[] {
  const rows: LegendModelRow[] = [];
  const { id: packId, manifest, styles } = pack;
  for (const layer of manifest.layers) {
    if (layerOnByKey[packLayerKey(packId, layer.id)] !== true) continue;
    const swatch = legendSwatchFromStyle(styles[layer.id], layer.geometryType);
    rows.push({
      id: packLayerKey(packId, layer.id),
      label: layer.name,
      ...(swatch != null ? { swatch } : {}),
    });
  }
  return rows;
}

export function buildLegendModel(registry: LayerRegistry, layerOnByKey: Record<string, boolean>): LegendModel {
  const groups: LegendModelGroup[] = [];
  for (const pack of registry.packs) {
    const rows =
      pack.id === OCTOBER_7TH_PACK_ID
        ? buildOctober7thActiveLegendRows(pack.id, pack.manifest.layers, layerOnByKey, pack.styles)
        : rowsForDefaultPack(pack, layerOnByKey);
    if (rows.length === 0) continue;
    groups.push({
      packId: pack.id,
      packName: pack.displayName,
      rows,
    });
  }
  return { groups };
}
