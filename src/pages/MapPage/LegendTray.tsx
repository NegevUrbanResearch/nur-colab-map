import { useRef, useEffect } from "react";

export type LegendTrayGroup = { id: string; label: string; detail?: string };

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  groups: LegendTrayGroup[];
  emptyMessage?: string;
};

export default function LegendTray({
  open,
  onClose,
  title = "מקרא",
  groups,
  emptyMessage = "אין כרגע ערכי מקרא לשכבות הפעילות.",
}: Props) {
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => closeBtnRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="legend-tray-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="legend-tray" role="dialog" aria-label={title} dir="rtl" onClick={(e) => e.stopPropagation()}>
        <div className="legend-tray__head">
          <h2 className="legend-tray__title">{title}</h2>
          <button
            type="button"
            ref={closeBtnRef}
            className="map-layer-ui-btn legend-tray__close"
            onClick={onClose}
            aria-label="סגור מקרא"
          >
            ✕
          </button>
        </div>
        <div className="legend-tray__body">
          {groups.length === 0 ? (
            <p className="legend-tray__empty">{emptyMessage}</p>
          ) : (
            <ul className="legend-tray__list" role="list">
              {groups.map((g) => (
                <li key={g.id} className="legend-tray__row">
                  <span className="legend-tray__row-label">{g.label}</span>
                  {g.detail ? <span className="legend-tray__row-detail">{g.detail}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
