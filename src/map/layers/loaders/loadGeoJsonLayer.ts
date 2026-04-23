import type { GeoJSON } from "geojson";
import L from "leaflet";
import type { LoadedLayer, LoadLayerArgs } from "../types";
import { popupContentFromUi } from "../popupContent";

export async function loadGeoJsonLayer(args: LoadLayerArgs): Promise<LoadedLayer> {
  const res = await fetch(args.urls.geojsonUrl);
  if (!res.ok) {
    throw new Error(`GeoJSON fetch failed: ${res.status} ${args.urls.geojsonUrl}`);
  }
  const data = (await res.json()) as GeoJSON;

  const layer = L.geoJSON(data, {
    style: args.geojsonStyle,
    onEachFeature(feature, leafletFeature) {
      const html = popupContentFromUi(args.ui, feature);
      if (html) leafletFeature.bindPopup(html);
    },
  });

  layer.addTo(args.map);
  return { mode: "geojson", layer };
}
