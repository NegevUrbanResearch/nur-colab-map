import type { LayerRegistry } from "../../map/layers/types";
import type { PackAggregateState } from "./useLayerPackState";

type Props = {
  registry: LayerRegistry | null;
  focusedPackId: string | null;
  onSelectPack: (packId: string) => void;
  getPackState: (packId: string) => PackAggregateState;
  activeCountForPack: (packId: string) => number;
  onTogglePack: (packId: string) => void;
  disabled?: boolean;
};

function packMasterLabel(state: PackAggregateState): string {
  if (state === "on") return "כבה את כל שכבות החבילה";
  if (state === "off") return "הפעל את כל שכבות החבילה";
  return "הפעל הכל (חבילה חלקית)";
}

function PackMasterSwitch({
  state,
  onClick,
  disabled: dis,
}: {
  state: PackAggregateState;
  onClick: () => void;
  disabled?: boolean;
}) {
  const pressed: boolean | "mixed" = state === "partial" ? "mixed" : state === "on";
  return (
    <button
      type="button"
      className={`pack-master-switch${state === "on" ? " pack-master-switch--on" : ""}${state === "partial" ? " pack-master-switch--partial" : ""}`}
      onClick={onClick}
      disabled={dis}
      title={packMasterLabel(state)}
      aria-label={packMasterLabel(state)}
      aria-pressed={pressed}
    >
      <span className="pack-master-switch__thumb" aria-hidden />
    </button>
  );
}

export default function LayerPackChipsScroller({
  registry,
  focusedPackId,
  onSelectPack,
  getPackState,
  activeCountForPack,
  onTogglePack,
  disabled,
}: Props) {
  const packs = registry?.packs ?? [];
  if (packs.length === 0) return null;

  const midpoint = Math.ceil(packs.length / 2);
  const rowA = packs.slice(0, midpoint);
  const rowB = packs.slice(midpoint);

  const renderChip = (p: (typeof packs)[0]) => {
    const n = activeCountForPack(p.id);
    const total = p.manifest.layers.length;
    const state = getPackState(p.id);
    const focused = p.id === focusedPackId;
    return (
      <div
        key={p.id}
        className={`layer-packs-sheet-pack-chip${focused ? " layer-packs-sheet-pack-chip--focused" : ""}`}
      >
        <PackMasterSwitch state={state} onClick={() => onTogglePack(p.id)} disabled={disabled} />
        <button
          type="button"
          className="layer-packs-sheet-pack-chip__select"
          onClick={() => onSelectPack(p.id)}
          disabled={disabled}
          aria-pressed={focused}
          aria-label={
            focused
              ? `חבילה ${p.displayName}, ממוקדת לעריכה. ${n} מתוך ${total} שכבות פעילות`
              : `בחר חבילה ${p.displayName}. ${n} מתוך ${total} שכבות פעילות`
          }
        >
          <span className="layer-packs-sheet-pack-chip__name">{p.displayName}</span>
          <span className="layer-packs-sheet-pack-chip__count" aria-hidden="true">
            {n}/{total}
          </span>
        </button>
      </div>
    );
  };

  return (
    <div className="layer-packs-sheet-pack-scroller" dir="rtl" aria-label="בחירת חבילת שכבות">
      <div className="layer-packs-sheet-pack-rows">
        <div className="layer-packs-sheet-pack-row" role="presentation">
          {rowA.map(renderChip)}
        </div>
        {rowB.length > 0 ? (
          <div className="layer-packs-sheet-pack-row" role="presentation">
            {rowB.map(renderChip)}
          </div>
        ) : null}
      </div>
    </div>
  );
}
