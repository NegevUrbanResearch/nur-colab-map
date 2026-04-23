import type { LayerRegistry } from "../../map/layers/types";

type Props = {
  registry: LayerRegistry | null;
  focusedPackId: string | null;
  onSelectPack: (packId: string) => void;
  activeCountForPack: (packId: string) => number;
  disabled?: boolean;
};

export default function LayerPackChipsScroller({
  registry,
  focusedPackId,
  onSelectPack,
  activeCountForPack,
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
    const focused = p.id === focusedPackId;
    return (
      <div key={p.id} className="layer-packs-sheet-pack-chip">
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
    <div
      className="layer-packs-sheet-pack-scroller"
      dir="rtl"
      role="region"
      aria-label="בחירת חבילת שכבות"
    >
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
