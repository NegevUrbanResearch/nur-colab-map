import L from "leaflet";
import type { DetourPaintPiece } from "../utils/pinkLineRoute";

/** Stays above standard layer packs (see MapPage manifest overlays). */
export const PRIORITY_PINK_OVERLAY_PANE = "priorityPinkOverlay";

export function ensurePriorityPinkOverlayPane(map: L.Map): void {
  if (!map.getPane(PRIORITY_PINK_OVERLAY_PANE)) {
    const el = map.createPane(PRIORITY_PINK_OVERLAY_PANE);
    el.style.zIndex = "650";
    el.style.pointerEvents = "auto";
  }
}

function withPriorityPane(style: L.PolylineOptions): L.PolylineOptions {
  return { ...style, pane: PRIORITY_PINK_OVERLAY_PANE };
}

const OFF_ROAD_LINE: L.PolylineOptions = {
  color: "#C62828",
  weight: 4,
  opacity: 0.95,
  dashArray: "6 10",
  lineCap: "round",
  pane: PRIORITY_PINK_OVERLAY_PANE,
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
  proposedPrimary: L.PolylineOptions,
  layersOut: L.Layer[],
  proposedHalo?: L.PolylineOptions,
  proposedSecondary?: L.PolylineOptions
): void {
  ensurePriorityPinkOverlayPane(map);

  const offroadPieces: Extract<DetourPaintPiece, { kind: "offroad" }>[] = [];

  for (const piece of pieces) {
    if (piece.kind === "road") {
      if (proposedHalo) {
        layersOut.push(
          L.polyline(
            piece.points as L.LatLngExpression[],
            withPriorityPane(proposedHalo)
          ).addTo(map)
        );
      }
      if (proposedSecondary) {
        layersOut.push(
          L.polyline(
            piece.points as L.LatLngExpression[],
            withPriorityPane(proposedSecondary)
          ).addTo(map)
        );
      }
      const pl = L.polyline(
        piece.points as L.LatLngExpression[],
        withPriorityPane(proposedPrimary)
      ).addTo(map);
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
      pane: PRIORITY_PINK_OVERLAY_PANE,
    }).addTo(map);
    junction.bindTooltip(OFF_ROAD_TOOLTIP_HTML, {
      sticky: true,
      direction: "top",
      className: "pink-offroad-route-tooltip",
    });
    layersOut.push(junction);
  }
}
