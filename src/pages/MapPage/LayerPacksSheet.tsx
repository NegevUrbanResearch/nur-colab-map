import { useEffect, useId, useRef, type ReactNode } from "react";

import { useDialogFocusTrap } from "./useDialogFocusTrap";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Total layers on across all packs; shown subtly in the header when defined. */
  totalActiveLayerCount?: number;
  /**
   * Optional control rendered in the header, visually to the “left” of the title in RTL
   * (e.g. focused pack master toggle with hint text).
   */
  headAccessory?: ReactNode;
  /** Horizontal pack scroller (inside sheet, under header). */
  packStrip?: ReactNode;
  children: ReactNode;
};

export default function LayerPacksSheet({
  open,
  onClose,
  title = "שכבות",
  totalActiveLayerCount,
  headAccessory,
  packStrip,
  children,
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
      className="layer-packs-sheet-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="layer-packs-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="layer-packs-sheet__head">
          <div className="layer-packs-sheet__head-main">
            <h2 className="layer-packs-sheet__title" id={labelId}>
              {title}
            </h2>
            {headAccessory ? (
              <div className="layer-packs-sheet__head-accessory">{headAccessory}</div>
            ) : null}
            {typeof totalActiveLayerCount === "number" ? (
              <span
                className="layer-packs-sheet__active-total"
                aria-label={`${totalActiveLayerCount} שכבות פעילות`}
              >
                {totalActiveLayerCount} פעיל
              </span>
            ) : null}
          </div>
          <button
            type="button"
            ref={closeBtnRef}
            className="map-layer-ui-btn layer-packs-sheet__close"
            onClick={onClose}
            aria-label="סגור"
          >
            ✕
          </button>
        </div>
        {packStrip ? <div className="layer-packs-sheet__pack-strip-wrap">{packStrip}</div> : null}
        <div className="layer-packs-sheet__body">{children}</div>
      </div>
    </div>
  );
}
