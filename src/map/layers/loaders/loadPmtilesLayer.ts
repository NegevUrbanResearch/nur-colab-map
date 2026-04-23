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
  const gt = args.layerGeometryType?.toLowerCase();
  const geometryHint = gt === "line" ? "line" : "polygon";
  const paintRules = styleToLeaflet(args.style, { dataLayer, geometryHint });

  const grid = leafletLayer({
    url,
    paintRules,
  });

  grid.addTo(args.map);
  return { mode: "pmtiles", layer: grid as unknown as Layer };
}
