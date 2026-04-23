import type { BasemapId } from "./useLayerPackState";
import BasemapSwapButton from "./BasemapSwapButton";

type Props = {
  totalActiveLayerCount: number;
  onOpenLayerSheet: () => void;
  onToggleLegend: () => void;
  basemap: BasemapId;
  onCycleBasemap: () => void;
  disabled?: boolean;
};

function layersButtonAriaLabel(activeCount: number): string {
  if (activeCount === 0) return "שכבות, אין שכבות פעילות";
  if (activeCount === 1) return "שכבות, שכבה אחת פעילה";
  return `שכבות, ${activeCount} שכבות פעילות`;
}

/** Bottom compact strip: layers, legend, basemap only (pack chips live in the layers sheet). */
export default function LayerPackStrip({
  totalActiveLayerCount,
  onOpenLayerSheet,
  onToggleLegend,
  basemap,
  onCycleBasemap,
  disabled,
}: Props) {
  return (
    <div className="layer-pack-strip" dir="rtl" aria-label="בקרת שכבות">
      <div className="layer-pack-strip__primary">
        <button
          type="button"
          className="map-layer-ui-btn layer-pack-strip__trigger"
          onClick={onOpenLayerSheet}
          disabled={disabled}
          title="הצג שכבות (חבילה ממוקדת)"
          aria-label={layersButtonAriaLabel(totalActiveLayerCount)}
        >
          שכבות
          <span className="layer-pack-strip__count-bubble" aria-hidden="true">
            {totalActiveLayerCount}
          </span>
        </button>
        <button
          type="button"
          className="map-layer-ui-btn layer-pack-strip__trigger"
          onClick={onToggleLegend}
          disabled={disabled}
          title="הצג מקרא"
        >
          מקרא
        </button>
        <BasemapSwapButton basemap={basemap} onToggle={onCycleBasemap} disabled={disabled} />
      </div>
    </div>
  );
}
