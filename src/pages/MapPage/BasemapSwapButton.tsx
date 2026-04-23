import type { BasemapId } from "./useLayerPackState";

const LABEL: Record<BasemapId, string> = {
  satellite: "בסיס: לוויין",
  osm: "בסיס: OSM",
};

type Props = {
  basemap: BasemapId;
  onToggle: () => void;
  className?: string;
  disabled?: boolean;
};

export default function BasemapSwapButton({ basemap, onToggle, className = "", disabled }: Props) {
  return (
    <button
      type="button"
      className={`map-layer-ui-btn basemap-swap-btn ${className}`.trim()}
      dir="rtl"
      onClick={onToggle}
      disabled={disabled}
      title={LABEL[basemap]}
    >
      {LABEL[basemap]}
    </button>
  );
}
