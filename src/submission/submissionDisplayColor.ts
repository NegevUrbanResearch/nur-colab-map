/**
 * Canonical allowlist (24 saturated hues). Order is stable API surface.
 * Must stay in sync with `supabase/migrations/20260419203000_submission_display_color_palette_v5_readability.sql`
 * (CHECK constraint + `submit_unified_submission_write` palette array + legacy row migration map).
 */
export const SUBMISSION_DISPLAY_COLOR_PALETTE = [
  "#DC2626",
  "#EA580C",
  "#EAB308",
  "#65A30D",
  "#16A34A",
  "#059669",
  "#0D9488",
  "#06B6D4",
  "#0284C7",
  "#2563EB",
  "#4338CA",
  "#6D28D9",
  "#A855F7",
  "#C026D3",
  "#F472B6",
  "#FB923C",
  "#0C4A6E",
  "#3F3F46",
  "#B45309",
  "#15803D",
  "#581C87",
  "#1E40AF",
  "#155E75",
  "#78716C",
] as const;

/**
 * Cross-hue partners for dual-dash proposed lines (not tints of the primary). Index aligns with
 * `SUBMISSION_DISPLAY_COLOR_PALETTE`. DB stores primary only; secondaries need not be unique across
 * slots and may repeat a palette primary as the partner stroke.
 */
export const SUBMISSION_DISPLAY_COLOR_SECONDARY = [
  "#22D3EE",
  "#2563EB",
  "#DB2777",
  "#C026D3",
  "#9333EA",
  "#EA580C",
  "#FB923C",
  "#F97316",
  "#FBBF24",
  "#FB7185",
  "#84CC16",
  "#FACC15",
  "#CA8A04",
  "#14B8A6",
  "#FDE047",
  "#6366F1",
  "#38BDF8",
  "#FBBF24",
  "#3B82F6",
  "#EC4899",
  "#34D399",
  "#FDE047",
  "#F472B6",
  "#F59E0B",
] as const;

const ALLOW = new Set(
  SUBMISSION_DISPLAY_COLOR_PALETTE.map((h) => h.toUpperCase())
);

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

export function normalizeSubmissionDisplayColorHex(
  raw: string
): string | null {
  const t = raw.trim();
  if (!HEX_RE.test(t)) return null;
  return `#${t.slice(1).toUpperCase()}`;
}

export function isAllowedSubmissionDisplayColor(raw: string): boolean {
  const n = normalizeSubmissionDisplayColorHex(raw);
  return n !== null && ALLOW.has(n);
}

export function secondaryHexForPrimaryNormalized(raw: string): string | null {
  const n = normalizeSubmissionDisplayColorHex(raw);
  if (n === null) return null;
  const i = SUBMISSION_DISPLAY_COLOR_PALETTE.findIndex(
    (h) => h.toUpperCase() === n
  );
  if (i < 0) return null;
  return SUBMISSION_DISPLAY_COLOR_SECONDARY[i]!.toUpperCase();
}

/**
 * Palette colors the user may pick: unused slots plus the submission’s own color(s)
 * when those map to reserved “self” hues (source batch / loaded overwrite).
 */
export function listPickableSubmissionDisplayColors(params: {
  usedColorsUpper: Iterable<string>;
  selfColorUpper?: string | null;
  loadedOverwriteColorUpper?: string | null;
}): string[] {
  const usedSet = new Set<string>();
  for (const raw of params.usedColorsUpper) {
    if (typeof raw !== "string") continue;
    const t = raw.trim().toUpperCase();
    if (t) usedSet.add(t);
  }
  const selfU =
    params.selfColorUpper != null && params.selfColorUpper !== ""
      ? params.selfColorUpper.trim().toUpperCase()
      : null;
  const loadedU =
    params.loadedOverwriteColorUpper != null &&
    params.loadedOverwriteColorUpper !== ""
      ? params.loadedOverwriteColorUpper.trim().toUpperCase()
      : null;

  const out: string[] = [];
  for (const hex of SUBMISSION_DISPLAY_COLOR_PALETTE) {
    const upper = hex.toUpperCase();
    const isSelf =
      (selfU != null && upper === selfU) || (loadedU != null && upper === loadedU);
    const isUsedElsewhere = usedSet.has(upper);
    if (!isUsedElsewhere || isSelf) {
      out.push(normalizeSubmissionDisplayColorHex(hex)!);
    }
  }
  return out;
}
