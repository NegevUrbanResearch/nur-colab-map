import type { LoadedLayer, LoadLayerArgs } from "../types";
import { loadGeoJsonLayer } from "./loadGeoJsonLayer";
import { loadPmtilesLayer } from "./loadPmtilesLayer";

export type { LoadedLayer, LoadLayerArgs } from "../types";

export async function loadLayerIntoMap(args: LoadLayerArgs): Promise<LoadedLayer> {
  if (args.urls.pmtilesUrl) {
    try {
      return await loadPmtilesLayer(args);
    } catch {
      // fallback is intentional for resilience
    }
  }
  if (!args.urls.geojsonUrl) {
    throw new Error("loadLayerIntoMap: no geojsonUrl and PMTiles failed or was absent");
  }
  const pmtilesAttempted = Boolean(args.urls.pmtilesUrl);
  return loadGeoJsonLayer(
    pmtilesAttempted ? { ...args, geojsonInteractive: args.geojsonInteractive ?? true } : args,
  );
}
