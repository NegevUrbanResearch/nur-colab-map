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
  return loadGeoJsonLayer(args);
}
