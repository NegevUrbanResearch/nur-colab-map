/**
 * Canonical allowlist (16 saturated hues). Order is stable API surface.
 * Must stay in sync with `supabase/migrations/20260418120000_submission_display_color_palette_v2.sql`
 * (CHECK constraint + `submit_unified_submission_write` palette array + legacy row migration map).
 */
export const SUBMISSION_DISPLAY_COLOR_PALETTE = [
  "#E11D48",
  "#F97316",
  "#EAB308",
  "#65A30D",
  "#16A34A",
  "#059669",
  "#0D9488",
  "#0891B2",
  "#0284C7",
  "#2563EB",
  "#4338CA",
  "#6D28D9",
  "#A21CAF",
  "#C026D3",
  "#DB2777",
  "#F43F5E",
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
