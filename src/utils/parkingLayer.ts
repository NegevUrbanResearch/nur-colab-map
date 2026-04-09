import L from "leaflet";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function addParkingLotsLayer(
  map: L.Map,
  geojsonUrl: string,
  iconUrl: string,
  isMapStillValid: () => boolean
): Promise<L.LayerGroup | null> {
  const res = await fetch(geojsonUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch parking GeoJSON (${res.status})`);
  }
  const geojson = (await res.json()) as GeoJSON.FeatureCollection;

  if (!isMapStillValid()) return null;

  const icon = L.icon({
    iconUrl: iconUrl,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });

  const group = L.layerGroup();
  for (const f of geojson.features) {
    const g = f.geometry;
    if (!g || g.type !== "Point") continue;
    const c = g.coordinates;
    const lng = c[0] as number;
    const lat = c[1] as number;
    const props = (f.properties || {}) as { name?: string | null; notes?: string | null };
    const parts: string[] = [];
    if (props.name) parts.push(`<strong>${escapeHtml(String(props.name))}</strong>`);
    if (props.notes) parts.push(escapeHtml(String(props.notes)));
    const html = parts.length > 0 ? parts.join("<br/>") : "חניה פוטנציאלית";
    L.marker([lat, lng], { icon }).bindPopup(html).addTo(group);
  }

  if (!isMapStillValid()) return null;
  group.addTo(map);
  return group;
}
