import L from "leaflet";

export const BASEMAP_TILE_URL = {
  satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  osm: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
} as const;

export type BasemapTileKind = keyof typeof BASEMAP_TILE_URL;

export function createBasemapTileLayer(kind: BasemapTileKind): L.TileLayer {
  if (kind === "satellite") {
    return L.tileLayer(BASEMAP_TILE_URL.satellite, {
      maxZoom: 19,
      attribution: "Tiles &copy; Esri",
    });
  }
  return L.tileLayer(BASEMAP_TILE_URL.osm, {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap",
  });
}
