import { useCallback, useEffect, useMemo, useState } from "react";
import type { LayerRegistry } from "../../map/layers/types";

export type PackAggregateState = "off" | "partial" | "on";

export type BasemapId = "satellite" | "osm";

export function getLayerKey(packId: string, layerId: string): string {
  return `${packId}::${layerId}`;
}

export function packAggregateFromLayerBooleans(values: boolean[]): PackAggregateState {
  if (values.length === 0) return "off";
  const on = values.filter(Boolean).length;
  if (on === 0) return "off";
  if (on === values.length) return "on";
  return "partial";
}

export function nextLayerStateAfterPackToggle(
  prev: Record<string, boolean>,
  packId: string,
  layerIds: string[],
  _registry: LayerRegistry | null
): Record<string, boolean> {
  void _registry;
  const keys = layerIds.map((id) => getLayerKey(packId, id));
  const values = keys.map((k) => prev[k] === true);
  const agg = packAggregateFromLayerBooleans(values);
  const allOn = agg === "on";
  const nextVal = allOn ? false : true;
  const out: Record<string, boolean> = { ...prev };
  for (const k of keys) {
    out[k] = nextVal;
  }
  return out;
}

export function nextLayerStateAfterLayerToggle(
  prev: Record<string, boolean>,
  packId: string,
  layerId: string,
  on: boolean,
  _registry: LayerRegistry | null
): Record<string, boolean> {
  void _registry;
  const k = getLayerKey(packId, layerId);
  return { ...prev, [k]: on };
}

function collectLayerKeys(registry: LayerRegistry): string[] {
  const keys: string[] = [];
  for (const p of registry.packs) {
    for (const l of p.manifest.layers) {
      keys.push(getLayerKey(p.id, l.id));
    }
  }
  return keys;
}

/** Keeps only keys present in `registry`; drops stale entries so counts stay accurate after pack/layer changes. */
export function reconcileLayerOnByKeyWithRegistry(
  prev: Record<string, boolean>,
  registry: LayerRegistry
): Record<string, boolean> {
  const next: Record<string, boolean> = {};
  for (const k of collectLayerKeys(registry)) {
    next[k] = prev[k] === true;
  }
  return next;
}

export function useLayerPackState(registry: LayerRegistry | null) {
  const [layerOnByKey, setLayerOnByKey] = useState<Record<string, boolean>>({});
  const [focusedPackId, setFocusedPackId] = useState<string | null>(null);
  const [basemap, setBasemap] = useState<BasemapId>("satellite");

  useEffect(() => {
    if (!registry || registry.packs.length === 0) {
      setLayerOnByKey({});
      setFocusedPackId(null);
      return;
    }
    setLayerOnByKey((prev) => reconcileLayerOnByKeyWithRegistry(prev, registry));
    setFocusedPackId((cur) => {
      if (cur && registry.packs.some((p) => p.id === cur)) return cur;
      return registry.packs[0]!.id;
    });
  }, [registry]);

  const getPackState = useCallback(
    (packId: string): PackAggregateState => {
      if (!registry) return "off";
      const pack = registry.packs.find((p) => p.id === packId);
      if (!pack) return "off";
      const values = pack.manifest.layers.map((l) => layerOnByKey[getLayerKey(packId, l.id)] === true);
      return packAggregateFromLayerBooleans(values);
    },
    [registry, layerOnByKey]
  );

  const togglePack = useCallback(
    (packId: string) => {
      if (!registry) return;
      const pack = registry.packs.find((p) => p.id === packId);
      if (!pack) return;
      const layerIds = pack.manifest.layers.map((l) => l.id);
      setLayerOnByKey((m) => nextLayerStateAfterPackToggle(m, packId, layerIds, registry));
    },
    [registry]
  );

  const setLayerOn = useCallback(
    (packId: string, layerId: string, on: boolean) => {
      if (!registry) return;
      setLayerOnByKey((m) => nextLayerStateAfterLayerToggle(m, packId, layerId, on, registry));
    },
    [registry]
  );

  const toggleLayer = useCallback(
    (packId: string, layerId: string) => {
      if (!registry) return;
      setLayerOnByKey((m) => {
        const k = getLayerKey(packId, layerId);
        const next = !(m[k] === true);
        return nextLayerStateAfterLayerToggle(m, packId, layerId, next, registry);
      });
    },
    [registry]
  );

  const totalActiveLayerCount = useMemo(
    () => Object.values(layerOnByKey).filter(Boolean).length,
    [layerOnByKey]
  );

  const activeCountForPack = useCallback(
    (packId: string): number => {
      if (!registry) return 0;
      const pack = registry.packs.find((p) => p.id === packId);
      if (!pack) return 0;
      return pack.manifest.layers.filter((l) => layerOnByKey[getLayerKey(packId, l.id)]).length;
    },
    [registry, layerOnByKey]
  );

  const isLayerOn = useCallback(
    (packId: string, layerId: string) => layerOnByKey[getLayerKey(packId, layerId)] === true,
    [layerOnByKey]
  );

  return {
    focusedPackId,
    setFocusedPackId,
    basemap,
    setBasemap,
    layerOnByKey,
    getPackState,
    activeCountForPack,
    totalActiveLayerCount,
    togglePack,
    setLayerOn,
    toggleLayer,
    isLayerOn,
  };
}
