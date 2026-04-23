import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function tabbableEls(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => {
    if (el.hasAttribute("disabled")) return false;
    if (el.getAttribute("aria-hidden") === "true") return false;
    const style = getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none") return false;
    return el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0;
  });
}

/**
 * When `active`, traps Tab/Shift+Tab within `containerRef` and restores focus to the
 * previously focused element when deactivated.
 */
export function useDialogFocusTrap(active: boolean, containerRef: RefObject<HTMLElement | null>) {
  const returnRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    const prev = document.activeElement;
    if (prev instanceof HTMLElement) returnRef.current = prev;
    else returnRef.current = null;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !containerRef.current) return;
      const list = tabbableEls(containerRef.current);
      if (list.length === 0) return;
      const first = list[0]!;
      const last = list[list.length - 1]!;
      const a = document.activeElement as Node | null;
      if (a && !containerRef.current.contains(a)) return;

      if (e.shiftKey) {
        if (a === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (a === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      const el = returnRef.current;
      if (el && typeof el.focus === "function") {
        try {
          el.focus();
        } catch {
          /* ignore */
        }
      }
      returnRef.current = null;
    };
  }, [active, containerRef]);
}
