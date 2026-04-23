import type { LayerManifestEntry } from "../../map/layers/types";

type Props = {
  layers: LayerManifestEntry[];
  isLayerOn: (layerId: string) => boolean;
  onToggleLayer: (layerId: string) => void;
};

export default function LayerTilesGrid({ layers, isLayerOn, onToggleLayer }: Props) {
  if (layers.length === 0) {
    return (
      <p className="layer-tiles-grid-empty" dir="rtl">
        אין שכבות בחבילה זו.
      </p>
    );
  }
  return (
    <div className="layer-tiles-grid" dir="rtl">
      <ul className="layer-tiles-grid__list" role="list">
        {layers.map((layer) => {
          const on = isLayerOn(layer.id);
          return (
            <li key={layer.id} className="layer-tiles-grid__item">
              <button
                type="button"
                className={on ? "layer-tile layer-tile--on" : "layer-tile layer-tile--off"}
                aria-pressed={on}
                onClick={() => onToggleLayer(layer.id)}
              >
                <span className="layer-tile__label">{layer.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
