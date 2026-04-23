import type { Layer, LeafletMouseEvent } from "leaflet";
import L from "leaflet";
import { leafletLayer } from "protomaps-leaflet";
import type { LoadedLayer, LoadLayerArgs } from "../types";
import { createAdvancedPmtilesLayer } from "../advancedPmtilesLayer";
import { shouldUseAdvancedPmtilesPath } from "../advancedStyleEngine";
import { styleToLeaflet } from "../styleToLeaflet";
import {
  buildLayerPopupCtaButtonsHtml,
  buildLayerPopupPayload,
  layerUiDeclaresPopupFields,
  pickPropertiesFromPmtilesDebugPick,
  renderLayerPopupHtml,
  type PmtilesDebugPickEntry,
} from "../popupModel";
import { LAYER_POPUP_MAX_WIDTH_PX, LAYER_POPUP_MIN_WIDTH_PX } from "../popupLayout";

type ProtomapsPickMap = Map<string, PmtilesDebugPickEntry[]>;

type GridWithPick = L.GridLayer & {
  queryTileFeaturesDebug?(lng: number, lat: number, brushSize?: number): ProtomapsPickMap;
};

/**
 * Loads a protomaps-leaflet canvas layer for PMTiles.
 *
 * **Popup / click bridge:** When `ui` declares `popup.fields`, `pmtilesInteractive` is not `false`, and
 * the layer exposes `queryTileFeaturesDebug`, the grid is marked `interactive: true` and a click
 * handler runs the pick (protomaps-leaflet’s documented debug/basic pick API). Limitations upstream:
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
  const paintRules = shouldUseAdvancedPmtilesPath(args.style)
    ? createAdvancedPmtilesLayer({ style: args.style, dataLayer, geometryHint }).paintRules
    : styleToLeaflet(args.style, { dataLayer, geometryHint });

  const enablePopupBridge =
    layerUiDeclaresPopupFields(args.ui) && args.pmtilesInteractive !== false;

  const grid = leafletLayer({
    url,
    paintRules,
    interactive: false,
  } as Parameters<typeof leafletLayer>[0] & { interactive: boolean }) as unknown as GridWithPick;

  const pmtilesPopupClickBridge =
    enablePopupBridge && typeof grid.queryTileFeaturesDebug === "function";
  if (pmtilesPopupClickBridge) {
    const g = grid as L.Layer & { options: { interactive?: boolean } };
    g.options = g.options ?? {};
    g.options.interactive = true;
  }

  grid.addTo(args.map);

  if (pmtilesPopupClickBridge) {
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
      const popup = L.popup({
        className: "layer-popup-embed",
        minWidth: LAYER_POPUP_MIN_WIDTH_PX,
        maxWidth: LAYER_POPUP_MAX_WIDTH_PX,
      })
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
