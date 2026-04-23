import type { Layer } from "leaflet";
import { leafletLayer } from "protomaps-leaflet";
import type { LoadedLayer, LoadLayerArgs } from "../types";
import { styleToLeaflet } from "../styleToLeaflet";

export async function loadPmtilesLayer(args: LoadLayerArgs): Promise<LoadedLayer> {
  const url = args.urls.pmtilesUrl;
  if (!url) {
    throw new Error("loadPmtilesLayer requires urls.pmtilesUrl");
  }

  const dataLayer = args.pmtilesSourceLayer ?? "layer";
  const paintRules = styleToLeaflet(args.style, { dataLayer });

  const grid = leafletLayer({
    url,
    paintRules,
  });

  grid.addTo(args.map);
  return { mode: "pmtiles", layer: grid as unknown as Layer };
}
