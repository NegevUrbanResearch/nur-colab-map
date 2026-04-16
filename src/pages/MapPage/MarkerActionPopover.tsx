import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import L from "leaflet";

export type MarkerActionPopoverTarget =
  | { kind: "pink"; tempId: string }
  | { kind: "memorial"; tempId: string; memorialScope: "central" | "local" };

export interface MarkerActionPopoverProps {
  map: L.Map | null;
  anchor: { lat: number; lng: number } | null;
  /** Marker type label (pink node vs memorial scope). */
  kindLabel: string;
  /** Resolved display name with caller-provided fallback when empty. */
  displayName: string;
  /** Resolved description with caller-provided fallback when empty. */
  displayDescription: string;
  onEdit: () => void;
  onDelete: () => void;
  /** Called after an outside pointerdown dismiss; passes the event for host-side gesture coordination. */
  onClose: (ev: PointerEvent) => void;
}

const computeFixedPosition = (map: L.Map, lat: number, lng: number) => {
  const container = map.getContainer();
  const rect = container.getBoundingClientRect();
  const pt = map.latLngToContainerPoint(L.latLng(lat, lng));
  return {
    left: rect.left + pt.x,
    top: rect.top + pt.y,
  };
};

const MarkerActionPopover = ({
  map,
  anchor,
  kindLabel,
  displayName,
  displayDescription,
  onEdit,
  onDelete,
  onClose,
}: MarkerActionPopoverProps) => {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const syncPosition = useCallback(() => {
    if (!map || !anchor) {
      setPos(null);
      return;
    }
    setPos(computeFixedPosition(map, anchor.lat, anchor.lng));
  }, [map, anchor]);

  useLayoutEffect(() => {
    syncPosition();
  }, [syncPosition]);

  useEffect(() => {
    if (!map) return;
    const onMapChange = () => syncPosition();
    map.on("move", onMapChange);
    map.on("zoom", onMapChange);
    map.on("resize", onMapChange);
    return () => {
      map.off("move", onMapChange);
      map.off("zoom", onMapChange);
      map.off("resize", onMapChange);
    };
  }, [map, syncPosition]);

  useEffect(() => {
    const onPointerDown = (ev: PointerEvent) => {
      const el = panelRef.current;
      if (!el) return;
      if (ev.target instanceof Node && el.contains(ev.target)) return;
      onClose(ev);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [onClose]);

  const ariaLabel = `${displayName}, ${kindLabel}`;

  if (!pos) return null;

  return (
    <div
      ref={panelRef}
      className="marker-action-popover"
      dir="rtl"
      role="dialog"
      aria-label={ariaLabel}
      style={{
        position: "fixed",
        left: pos.left,
        top: pos.top,
        transform: "translate(-50%, calc(-100% - 10px))",
        zIndex: 1004,
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="marker-action-popover__content">
        <div className="marker-action-popover__kind">{kindLabel}</div>
        <div className="marker-action-popover__name">{displayName}</div>
        <div className="marker-action-popover__description">{displayDescription}</div>
      </div>
      <div className="marker-action-popover__actions">
        <button type="button" className="marker-action-popover__btn marker-action-popover__btn--primary" onClick={onEdit}>
          עריכה
        </button>
        <button type="button" className="marker-action-popover__btn marker-action-popover__btn--danger" onClick={onDelete}>
          מחיקה
        </button>
      </div>
    </div>
  );
};

export default MarkerActionPopover;
