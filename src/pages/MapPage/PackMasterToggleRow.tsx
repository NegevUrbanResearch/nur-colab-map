import type { LayerRegistry } from "../../map/layers/types";
import type { PackAggregateState } from "./useLayerPackState";

type Props = {
  registry: LayerRegistry | null;
  /** Master toggle applies only to this pack; hide when null or unknown. */
  focusedPackId: string | null;
  getPackState: (packId: string) => PackAggregateState;
  onTogglePack: (packId: string) => void;
  disabled?: boolean;
};

function packMasterActionLabel(state: PackAggregateState): string {
  if (state === "on") return "כבה את כל שכבות החבילה";
  if (state === "off") return "הפעל את כל שכבות החבילה";
  return "הפעל הכל (חבילה חלקית)";
}

function PackMasterSwitch({
  state,
  onClick,
  disabled: dis,
  ariaLabel,
}: {
  state: PackAggregateState;
  onClick: () => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  const pressed: boolean | "mixed" = state === "partial" ? "mixed" : state === "on";
  return (
    <button
      type="button"
      className={`pack-focus-master__switch${state === "on" ? " pack-focus-master__switch--on" : ""}${state === "partial" ? " pack-focus-master__switch--partial" : ""}`}
      onClick={onClick}
      disabled={dis}
      title={ariaLabel}
      aria-label={ariaLabel}
      aria-pressed={pressed}
    >
      <span className="pack-focus-master__switch-thumb" aria-hidden />
    </button>
  );
}

export default function PackMasterToggleRow({
  registry,
  focusedPackId,
  getPackState,
  onTogglePack,
  disabled,
}: Props) {
  if (!registry || !focusedPackId) return null;
  const pack = registry.packs.find((p) => p.id === focusedPackId);
  if (!pack) return null;

  const state = getPackState(pack.id);
  const ariaLabel = `${pack.displayName}: ${packMasterActionLabel(state)}`;

  return (
    <div
      className="pack-focus-master"
      dir="rtl"
      role="group"
      aria-label={`${pack.displayName}: בקרה מהירה — ${packMasterActionLabel(state)}`}
    >
      <PackMasterSwitch
        state={state}
        onClick={() => onTogglePack(pack.id)}
        disabled={disabled}
        ariaLabel={ariaLabel}
      />
      <div className="pack-focus-master__text">
        <span className="pack-focus-master__hint">הפעל/כבה הכל</span>
      </div>
    </div>
  );
}
