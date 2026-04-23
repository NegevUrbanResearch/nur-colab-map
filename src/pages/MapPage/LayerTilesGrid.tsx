import type { LayerTileRow } from "../../map/layers/layerNameUtils";
import { packAggregateFromLayerBooleans } from "./useLayerPackState";

type Props = {
  rows: LayerTileRow[];
  isLayerOn: (layerId: string) => boolean;
  onToggleLayer: (layerId: string) => void;
  onToggleLayerGroup: (layerIds: string[]) => void;
};

function familyAggregate(
  memberIds: string[],
  isLayerOn: (layerId: string) => boolean
): "off" | "partial" | "on" {
  const values = memberIds.map((id) => isLayerOn(id));
  return packAggregateFromLayerBooleans(values);
}

export default function LayerTilesGrid({ rows, isLayerOn, onToggleLayer, onToggleLayerGroup }: Props) {
  if (rows.length === 0) {
    return (
      <p className="layer-tiles-grid-empty" dir="rtl">
        אין שכבות בחבילה זו.
      </p>
    );
  }
  return (
    <div className="layer-tiles-grid" dir="rtl">
      <ul className="layer-tiles-grid__list" role="list">
        {rows.map((row) => {
          if (row.kind === "layer") {
            const { layer } = row;
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
          }
          const memberIds = row.members.map((m) => m.id);
          const agg = familyAggregate(memberIds, isLayerOn);
          const ariaPressed = agg === "partial" ? "mixed" : agg === "on";
          const tileClass =
            agg === "on" ? "layer-tile layer-tile--on" : agg === "partial" ? "layer-tile layer-tile--partial" : "layer-tile layer-tile--off";
          return (
            <li key={`family:${row.familyKey}`} className="layer-tiles-grid__item">
              <button
                type="button"
                className={tileClass}
                aria-pressed={ariaPressed}
                onClick={() => onToggleLayerGroup(memberIds)}
              >
                <span className="layer-tile__label">{row.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
