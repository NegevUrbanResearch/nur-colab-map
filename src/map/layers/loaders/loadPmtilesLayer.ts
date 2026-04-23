import type { Layer, LeafletMouseEvent } from "leaflet";
import L from "leaflet";
import { leafletLayer } from "protomaps-leaflet";
import type { LoadedLayer, LoadLayerArgs } from "../types";
import { styleToLeaflet } from "../styleToLeaflet";
import {
  buildLayerPopupCtaButtonsHtml,
  buildLayerPopupPayload,
  layerUiDeclaresPopupFields,
  pickPropertiesFromPmtilesDebugPick,
  renderLayerPopupHtml,
  type PmtilesDebugPickEntry,
} from "../popupModel";

type ProtomapsPickMap = Map<string, PmtilesDebugPickEntry[]>;

type GridWithPick = L.GridLayer & {
  queryTileFeaturesDebug?(lng: number, lat: number, brushSize?: number): ProtomapsPickMap;
};

/**
 * Loads a protomaps-leaflet canvas layer for PMTiles.
 *
 * **Popup / click bridge:** When `ui` declares `popup.fields` and `pmtilesInteractive` is not `false`,
 * the grid is `interactive` and a click handler runs `queryTileFeaturesDebug` (protomaps-leaflet’s
 * documented debug/basic pick API). Limitations upstream:
 * - Only features in tiles already present in the layer’s in-memory cache are visible to the picker.
 * - No hover, cursor, or styling integration; ambiguous when multiple features overlap (we take the
 *   last candidate for the preferred MVT layer, or any layer as fallback).
 * - Library authors recommend MapLibre for full vector interactivity.
 */
export async function loadPmtilesLayer(args: LoadLayerArgs): Promise<LoadedLayer> {
  const url = args.urls.pmtilesUrl;
  if (!url) {
    throw new Error("loadPmtilesLayer requires urls.pmtilesUrl");
  }

  const dataLayer = args.pmtilesSourceLayer ?? "layer";
  const gt = args.layerGeometryType?.toLowerCase();
  const geometryHint = gt === "line" ? "line" : "polygon";
  const paintRules = styleToLeaflet(args.style, { dataLayer, geometryHint });

  const enablePopupBridge =
    layerUiDeclaresPopupFields(args.ui) && args.pmtilesInteractive !== false;

  const grid = leafletLayer({
    url,
    paintRules,
    interactive: enablePopupBridge || undefined,
  } as Parameters<typeof leafletLayer>[0] & { interactive?: boolean }) as unknown as GridWithPick;

  grid.addTo(args.map);

  if (enablePopupBridge && typeof grid.queryTileFeaturesDebug === "function") {
    const onPopupAction = args.onPopupAction;
    grid.on("click", (e: LeafletMouseEvent) => {
      const map = args.map;
      const wrapped = map.wrapLatLng(e.latlng);
      const picked = grid.queryTileFeaturesDebug!(wrapped.lng, wrapped.lat);
      const props = pickPropertiesFromPmtilesDebugPick(picked, dataLayer);
      if (!props) return;

      const ctaMode = args.getLayerPopupCtaMode?.() ?? "pink";
      const payload = buildLayerPopupPayload({ ui: args.ui, properties: props });
      const html = renderLayerPopupHtml(
        payload
          ? {
              ...payload,
              actionsHtml: onPopupAction ? buildLayerPopupCtaButtonsHtml(ctaMode) : undefined,
            }
          : null,
      );
      if (!html) return;
      if (e.originalEvent) {
        L.DomEvent.stopPropagation(e.originalEvent);
      }

      const latlng = e.latlng;
      const popup = L.popup({ maxWidth: 320, className: "layer-popup-embed" })
        .setLatLng(latlng)
        .setContent(html);

      if (onPopupAction) {
        popup.once("add", () => {
          const el = popup.getElement();
          if (!el) return;
          const ctaRoot = el.querySelector(".layer-popup__actions");
          if (!ctaRoot) return;
          const anchor = popup.getLatLng();
          if (!anchor) return;
          const ctaHandler = (ev: Event) => {
            const t = (ev.target as HTMLElement).closest("button[data-layer-popup-cta]");
            if (!t) return;
            L.DomEvent.stopPropagation(ev);
            L.DomEvent.preventDefault(ev);
            const k = t.getAttribute("data-layer-popup-cta");
            if (k === "create_pink_node")
              onPopupAction({ action: "create_pink_node", lat: anchor.lat, lng: anchor.lng });
            if (k === "create_memorial")
              onPopupAction({ action: "create_memorial", lat: anchor.lat, lng: anchor.lng });
          };
          ctaRoot.addEventListener("click", ctaHandler, { capture: true });
          const onRemove = () => {
            ctaRoot.removeEventListener("click", ctaHandler, { capture: true });
            popup.off("remove", onRemove);
          };
          popup.on("remove", onRemove);
        });
      }

      popup.openOn(map);
    });
  }

  return { mode: "pmtiles", layer: grid as unknown as Layer };
}
