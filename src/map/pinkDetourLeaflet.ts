import L from "leaflet";
import type { DetourPaintPiece } from "../utils/pinkLineRoute";

const PANE_OFFROAD_LINE = "pinkOffroadLinePane";

function ensureOffroadLinePane(map: L.Map) {
  if (!map.getPane(PANE_OFFROAD_LINE)) {
    const linePane = map.createPane(PANE_OFFROAD_LINE);
    linePane.style.zIndex = "550";
    linePane.style.pointerEvents = "auto";
  }
}

const OFF_ROAD_LINE: L.PolylineOptions = {
  color: "#C62828",
  weight: 4,
  opacity: 0.95,
  dashArray: "6 10",
  lineCap: "round",
  pane: PANE_OFFROAD_LINE,
};

function junctionDivIcon() {
  return L.divIcon({
    className: "pink-line-node-marker",
    html: '<div class="pink-offroad-junction-node" aria-hidden="true"></div>',
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

const OFF_ROAD_TOOLTIP_HTML = `<div class="pink-offroad-route-tooltip-inner" dir="rtl"><span class="pink-offroad-route-tooltip-line">אין כאן דרך רשמית ברשת הניווט.</span><span class="pink-offroad-route-tooltip-line">הקו האדום המקווקו מסמן הליכה ישירה לנקודה (ברגל).</span></div>`;

export function addDetourPaintToMap(
  map: L.Map,
  pieces: DetourPaintPiece[],
  dashedStyle: L.PolylineOptions,
  layersOut: L.Layer[]
): void {
  ensureOffroadLinePane(map);

  const offroadPieces: Extract<DetourPaintPiece, { kind: "offroad" }>[] = [];

  for (const piece of pieces) {
    if (piece.kind === "road") {
      const pl = L.polyline(piece.points as L.LatLngExpression[], dashedStyle).addTo(map);
      layersOut.push(pl);
    } else {
      offroadPieces.push(piece);
    }
  }

  for (const piece of offroadPieces) {
    const line = L.polyline(
      [piece.roadEnd, piece.target] as L.LatLngExpression[],
      OFF_ROAD_LINE
    ).addTo(map);
    line.bindTooltip(OFF_ROAD_TOOLTIP_HTML, {
      sticky: true,
      direction: "top",
      className: "pink-offroad-route-tooltip",
    });
    line.on("mouseover", () => {
      line.setStyle({ weight: 7, opacity: 1, color: "#FF5252" });
      line.bringToFront();
    });
    line.on("mouseout", () => {
      line.setStyle(OFF_ROAD_LINE);
    });
    layersOut.push(line);
  }

  for (const piece of offroadPieces) {
    const junction = L.marker(piece.roadEnd as L.LatLngExpression, {
      icon: junctionDivIcon(),
      keyboard: false,
      riseOnHover: true,
    }).addTo(map);
    junction.bindTooltip(OFF_ROAD_TOOLTIP_HTML, {
      sticky: true,
      direction: "top",
      className: "pink-offroad-route-tooltip",
    });
    layersOut.push(junction);
  }
}
