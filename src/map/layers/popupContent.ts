import type { Feature } from "geojson";
import {
  buildLayerPopupCtaButtonsHtml,
  buildLayerPopupPayload,
  featurePropertiesRecord,
  renderLayerPopupHtml,
} from "./popupModel";

export { buildLayerPopupPayload, renderLayerPopupHtml } from "./popupModel";

/** HTML snippet for Leaflet `bindPopup`, from manifest `ui` and GeoJSON feature properties. */
export function popupContentFromUi(
  ui: unknown,
  feature: Feature,
  options?: { includeCta?: boolean; ctaMode?: "pink" | "memorial" },
): string {
  const payload = buildLayerPopupPayload({
    ui,
    properties: featurePropertiesRecord(feature),
  });
  if (!payload) return "";
  return renderLayerPopupHtml({
    ...payload,
    actionsHtml: options?.includeCta
      ? buildLayerPopupCtaButtonsHtml(options.ctaMode ?? "pink")
      : undefined,
  });
}
