import { normalizeLegendFallbackLabel, OCTOBER_7TH_PACK_ID } from "../layerDisplayGlossary";
import { buildOctober7thActiveLegendRows, packLayerKey } from "../layerNameUtils";
import type { LayerRegistry, LayerRegistryPack } from "../types";
import { legendSwatchFromStyle } from "./legendSwatchFromStyle";
import type { LegendModel, LegendModelClassEntry, LegendModelGroup, LegendModelRow } from "./legendTypes";

export type {
  LegendModel,
  LegendModelClassEntry,
  LegendModelGroup,
  LegendModelRow,
  LegendSwatchPreview,
} from "./legendTypes";

function isRecord(x: unknown): x is Record<string, unknown> {
  return x != null && typeof x === "object";
}

/** When non-null, the style should expand to one legend row per class. */
function uniqueValueLegendPlan(style: unknown): { field: string; classes: Array<{ value: unknown; label: string }> } | null {
  if (!isRecord(style) || style.renderer !== "uniqueValue") return null;
  const uv = style.uniqueValues;
  if (!isRecord(uv)) return null;
  const fieldRaw = uv.field;
  const fieldName = typeof fieldRaw === "string" && fieldRaw.length > 0 ? fieldRaw : null;
  if (!fieldName) return null;
  const classesRaw = uv.classes;
  if (!Array.isArray(classesRaw) || classesRaw.length === 0) return null;
  const classes: Array<{ value: unknown; label: string }> = [];
  for (const c of classesRaw) {
    if (!isRecord(c) || !("value" in c)) continue;
    const labelRaw = c.label;
    const label =
      typeof labelRaw === "string" && labelRaw.length > 0 ? labelRaw : String(c.value);
    classes.push({ value: c.value, label });
  }
  if (classes.length === 0) return null;
  return { field: fieldName, classes };
}

function rowsForDefaultPack(pack: LayerRegistryPack, layerOnByKey: Record<string, boolean>): LegendModelRow[] {
  const rows: LegendModelRow[] = [];
  const { id: packId, manifest, styles } = pack;
  for (const layer of manifest.layers) {
    if (layerOnByKey[packLayerKey(packId, layer.id)] !== true) continue;
    const style = styles[layer.id];
    const uvPlan = uniqueValueLegendPlan(style);
    const baseId = packLayerKey(packId, layer.id);
    if (uvPlan != null) {
      const classEntries: LegendModelClassEntry[] = uvPlan.classes.map((cls, i) => {
        const previewProps = { [uvPlan.field]: cls.value };
        const swatch = legendSwatchFromStyle(style, layer.geometryType, previewProps);
        return {
          id: `${baseId}::uv::${i}`,
          label: normalizeLegendFallbackLabel(cls.label),
          ...(swatch != null ? { swatch } : {}),
        };
      });
      rows.push({
        id: baseId,
        label: normalizeLegendFallbackLabel(layer.name),
        classEntries,
      });
      continue;
    }
    const swatch = legendSwatchFromStyle(style, layer.geometryType);
    rows.push({
      id: baseId,
      label: normalizeLegendFallbackLabel(layer.name),
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
