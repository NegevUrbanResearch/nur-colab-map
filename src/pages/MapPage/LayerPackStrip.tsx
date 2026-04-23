import type { LayerRegistry } from "../../map/layers/types";
import type { BasemapId, PackAggregateState } from "./useLayerPackState";
import BasemapSwapButton from "./BasemapSwapButton";

type Props = {
  registry: LayerRegistry | null;
  totalActiveLayerCount: number;
  focusedPackId: string | null;
  onSelectPack: (packId: string) => void;
  getPackState: (packId: string) => PackAggregateState;
  activeCountForPack: (packId: string) => number;
  onTogglePack: (packId: string) => void;
  onOpenLayerSheet: () => void;
  onToggleLegend: () => void;
  basemap: BasemapId;
  onCycleBasemap: () => void;
  disabled?: boolean;
};

function packMasterTitle(state: PackAggregateState): string {
  if (state === "on") return "כבה את כל שכבות החבילה";
  if (state === "off") return "הפעל את כל שכבות החבילה";
  return "הפעל הכל (חבילה חלקית)";
}

function PackMasterControl({
  state,
  onClick,
  disabled: dis,
}: {
  state: PackAggregateState;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="map-layer-ui-btn pack-master-toggle"
      data-pack-state={state}
      onClick={onClick}
      disabled={dis}
      title={packMasterTitle(state)}
      aria-label={packMasterTitle(state)}
    >
      <span className="pack-master-toggle__icon" aria-hidden>
        {state === "on" ? "☑" : state === "partial" ? "◧" : "☐"}
      </span>
    </button>
  );
}

export default function LayerPackStrip({
  registry,
  totalActiveLayerCount,
  focusedPackId,
  onSelectPack,
  getPackState,
  activeCountForPack,
  onTogglePack,
  onOpenLayerSheet,
  onToggleLegend,
  basemap,
  onCycleBasemap,
  disabled,
}: Props) {
  const packs = registry?.packs ?? [];

  return (
    <div className="layer-pack-strip" dir="rtl" aria-label="בקרת שכבות">
      <div className="layer-pack-strip__primary">
        <button
          type="button"
          className="map-layer-ui-btn layer-pack-strip__trigger"
          onClick={onOpenLayerSheet}
          disabled={disabled}
          title="הצג שכבות (חבילה ממוקדת)"
        >
          שכבות
          <span className="layer-pack-strip__count-bubble" aria-label="שכבות פעילות">
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

      {packs.length > 0 && (
        <div className="layer-pack-strip__chips" role="group" aria-label="חבילות שכבות">
          {packs.map((p) => {
            const n = activeCountForPack(p.id);
            const total = p.manifest.layers.length;
            const state = getPackState(p.id);
            const focused = p.id === focusedPackId;
            return (
              <div key={p.id} className="layer-pack-chip" data-focused={focused ? "true" : "false"}>
                <button
                  type="button"
                  className="map-layer-ui-btn layer-pack-chip__select"
                  onClick={() => onSelectPack(p.id)}
                  disabled={disabled}
                  aria-pressed={focused}
                >
                  <span className="layer-pack-chip__name">{p.name}</span>
                  <span className="layer-pack-chip__count">
                    {n}/{total}
                  </span>
                </button>
                <PackMasterControl state={state} onClick={() => onTogglePack(p.id)} disabled={disabled} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
