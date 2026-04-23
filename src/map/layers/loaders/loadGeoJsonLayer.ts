import type { GeoJSON } from "geojson";
import type { LeafletMouseEvent } from "leaflet";
import L from "leaflet";
import type { LoadedLayer, LoadLayerArgs } from "../types";
import { layerUiDeclaresPopupFields } from "../popupModel";
import { popupContentFromUi } from "../popupContent";
import { LAYER_POPUP_MAX_WIDTH_PX, LAYER_POPUP_MIN_WIDTH_PX } from "../popupLayout";

function geoJsonLayerInteractive(args: LoadLayerArgs): boolean {
  if (args.geojsonInteractive === false) return false;
  if (args.geojsonInteractive === true) return true;
  return layerUiDeclaresPopupFields(args.ui);
}

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
    interactive: geoJsonLayerInteractive(args),
    style: args.geojsonStyle,
    pointToLayer: args.geojsonPointToLayer,
    onEachFeature(feature, leafletFeature) {
      const onAction = args.onPopupAction;
      const ctaModeGetter = args.getLayerPopupCtaMode;
      const getPopupContent = () =>
        popupContentFromUi(args.ui, feature, {
          includeCta: Boolean(onAction),
          ctaMode: ctaModeGetter ? ctaModeGetter() : "pink",
        });
      const initial = getPopupContent();
      if (initial) {
        leafletFeature.bindPopup(getPopupContent, {
          className: "layer-popup-embed",
          minWidth: LAYER_POPUP_MIN_WIDTH_PX,
          maxWidth: LAYER_POPUP_MAX_WIDTH_PX,
        });
        leafletFeature.on("click", (e: LeafletMouseEvent) => {
          if (e.originalEvent) {
            L.DomEvent.stopPropagation(e.originalEvent);
          }
        });
        if (onAction) {
          let ctaHandler: ((ev: Event) => void) | null = null;
          let ctaRoot: Element | null = null;
          leafletFeature.on("popupopen", () => {
            const p = leafletFeature.getPopup();
            if (!p) return;
            const el = p.getElement();
            if (!el) return;
            ctaRoot = el.querySelector(".layer-popup__actions");
            if (!ctaRoot) return;
            const latlng = p.getLatLng();
            if (!latlng) return;
            ctaHandler = (ev: Event) => {
              const t = (ev.target as HTMLElement).closest("button[data-layer-popup-cta]");
              if (!t) return;
              L.DomEvent.stopPropagation(ev);
              L.DomEvent.preventDefault(ev);
              const k = t.getAttribute("data-layer-popup-cta");
              if (k === "create_pink_node")
                onAction({ action: "create_pink_node", lat: latlng.lat, lng: latlng.lng });
              if (k === "create_memorial")
                onAction({ action: "create_memorial", lat: latlng.lat, lng: latlng.lng });
            };
            ctaRoot.addEventListener("click", ctaHandler, { capture: true });
          });
          leafletFeature.on("popupclose", () => {
            if (ctaHandler && ctaRoot) {
              ctaRoot.removeEventListener("click", ctaHandler, { capture: true });
            }
            ctaHandler = null;
            ctaRoot = null;
          });
        }
      }
    },
  });

  layer.addTo(args.map);
  return { mode: "geojson", layer };
}
