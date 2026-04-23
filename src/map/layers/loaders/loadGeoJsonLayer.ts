import type { GeoJSON } from "geojson";
import L from "leaflet";
import type { LoadedLayer, LoadLayerArgs } from "../types";
import { popupContentFromUi } from "../popupContent";

export async function loadGeoJsonLayer(args: LoadLayerArgs): Promise<LoadedLayer> {
  const url = args.urls.geojsonUrl;
  if (!url) {
    throw new Error("loadGeoJsonLayer requires urls.geojsonUrl");
  }

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`GeoJSON fetch failed: ${res.status} ${url}`);
  }
  const data = (await res.json()) as GeoJSON;

  const layer = L.geoJSON(data, {
    interactive: args.geojsonInteractive === true,
    style: args.geojsonStyle,
    pointToLayer: args.geojsonPointToLayer,
    onEachFeature(feature, leafletFeature) {
      const html = popupContentFromUi(args.ui, feature);
      if (html) leafletFeature.bindPopup(html);
    },
  });

  layer.addTo(args.map);
  return { mode: "geojson", layer };
}
