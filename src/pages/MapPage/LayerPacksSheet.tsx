import { useEffect, useId, useRef } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
};

export default function LayerPacksSheet({ open, onClose, title = "שכבות", children }: Props) {
  const labelId = useId();
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
      className="layer-packs-sheet-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="layer-packs-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="layer-packs-sheet__head">
          <h2 className="layer-packs-sheet__title" id={labelId}>
            {title}
          </h2>
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
        <div className="layer-packs-sheet__body">{children}</div>
      </div>
    </div>
  );
}
