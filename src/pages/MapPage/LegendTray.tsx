import { useRef, useEffect, useId } from "react";

import type { LegendModelRow, LegendSwatchPreview } from "../../map/layers/legend/legendTypes";
import { useDialogFocusTrap } from "./useDialogFocusTrap";

export type LegendTrayRow = LegendModelRow;

export type LegendTraySection = {
  id: string;
  title: string;
  rows: LegendTrayRow[];
};

function LegendSwatchView({ swatch }: { swatch: LegendSwatchPreview }) {
  if (swatch.kind === "line") {
    const h = Math.max(2, Math.min(6, swatch.strokeWidth ?? 2));
    const color = swatch.strokeColor ?? "rgba(255,255,255,0.5)";
    const op = swatch.strokeOpacity ?? 1;
    const dash = swatch.strokeDasharray?.trim();
    if (dash) {
      const pad = 2;
      return (
        <span className="legend-tray__swatch legend-tray__swatch--line" aria-hidden>
          <svg
            className="legend-tray__swatch-line legend-tray__swatch-line--dashed"
            width="100%"
            height={h + pad * 2}
            viewBox="0 0 40 10"
            preserveAspectRatio="none"
            style={{ display: "block" }}
          >
            <line
              x1="0"
              y1="5"
              x2="40"
              y2="5"
              stroke={color}
              strokeWidth={Math.max(1.2, Math.min(4, h))}
              strokeOpacity={op}
              strokeDasharray={dash}
              strokeLinecap="butt"
            />
          </svg>
        </span>
      );
    }
    return (
      <span className="legend-tray__swatch legend-tray__swatch--line" aria-hidden>
        <span
          className="legend-tray__swatch-line"
          style={{
            height: h,
            backgroundColor: color,
            opacity: op,
          }}
        />
      </span>
    );
  }

  if (swatch.kind === "point") {
    const px = Math.max(10, Math.min(20, (swatch.pointSizePx ?? 8) * 1.4));
    const br = swatch.pointShape === "square" ? "2px" : "50%";
    return (
      <span className="legend-tray__swatch legend-tray__swatch--point" aria-hidden>
        <span
          className="legend-tray__swatch-point"
          style={{
            width: px,
            height: px,
            borderRadius: br,
            backgroundColor: swatch.fillColor ?? "#888",
            border: `${Math.max(1, swatch.strokeWidth ?? 1)}px solid ${swatch.strokeColor ?? "#000"}`,
            opacity: swatch.fillOpacity ?? 1,
          }}
        />
      </span>
    );
  }

  const fill = swatch.fillColor ?? "rgba(128,128,128,0.45)";
  const fillOp = swatch.fillOpacity ?? 0.6;
  const stroke = swatch.strokeColor ?? "rgba(255,255,255,0.35)";
  const sw = Math.max(1, Math.min(3, swatch.strokeWidth ?? 1));
  return (
    <span className="legend-tray__swatch legend-tray__swatch--polygon" aria-hidden>
      <span
        className="legend-tray__swatch-polygon"
        style={{
          backgroundColor: fill,
          opacity: fillOp,
          border: `${sw}px solid ${stroke}`,
        }}
      />
    </span>
  );
}

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
  const labelId = useId();
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useDialogFocusTrap(open, dialogRef);

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
        ref={dialogRef}
        className="legend-tray"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="legend-tray__head">
          <h2 className="legend-tray__title" id={labelId}>
            {title}
          </h2>
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
                        <div className="legend-tray__row-inner">
                          <span className="legend-tray__row-label">{row.label}</span>
                          {row.swatch ? <LegendSwatchView swatch={row.swatch} /> : null}
                        </div>
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
