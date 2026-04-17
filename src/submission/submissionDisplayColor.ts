/** Canonical allowlist; must match SQL migration palette order. */
export const SUBMISSION_DISPLAY_COLOR_PALETTE = [
  "#C1121F",
  "#F48C06",
  "#FFBA08",
  "#136F63",
  "#3A86FF",
  "#8338EC",
  "#FF006E",
  "#38B000",
  "#0077B6",
  "#FB5607",
  "#3EC300",
  "#7209B7",
  "#00B4D8",
  "#E85D04",
  "#9D4EDD",
  "#2D6A4F",
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
