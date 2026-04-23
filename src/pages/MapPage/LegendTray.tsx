import { useRef, useEffect } from "react";

export type LegendTrayRow = { id: string; label: string; detail?: string };

export type LegendTraySection = {
  id: string;
  title: string;
  rows: LegendTrayRow[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  sections: LegendTraySection[];
  emptyMessage?: string;
};

export default function LegendTray({
  open,
  onClose,
  title = "מקרא",
  sections,
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
      <div
        className="legend-tray"
        role="dialog"
        aria-label={title}
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
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
          {sections.length === 0 ? (
            <p className="legend-tray__empty">{emptyMessage}</p>
          ) : (
            <div className="legend-tray__sections">
              {sections.map((section) => (
                <section key={section.id} className="legend-tray__section" aria-label={section.title}>
                  <h3 className="legend-tray__section-title">{section.title}</h3>
                  <ul className="legend-tray__list" role="list">
                    {section.rows.map((row) => (
                      <li key={row.id} className="legend-tray__row">
                        <span className="legend-tray__row-label">{row.label}</span>
                        {row.detail ? <span className="legend-tray__row-detail">{row.detail}</span> : null}
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
