/** Curated Hebrew display labels for merged October 7th geometry-variant families. */

export const OCTOBER_7TH_PACK_ID = "october_7th" as const;

export type October7thMergedFamilyKey = "חדירה_לישוב" | "מאבק_וגבורה" | "פגיעה_נקודתית";

const OCTOBER_MERGED_FAMILY_LABEL: Record<October7thMergedFamilyKey, string> = {
  חדירה_לישוב: "חדירה לישוב",
  מאבק_וגבורה: "מאבק וגבורה",
  פגיעה_נקודתית: "פגיעה נקודתית",
};

export function october7thMergedFamilyLabel(familyKey: October7thMergedFamilyKey): string {
  return OCTOBER_MERGED_FAMILY_LABEL[familyKey];
}

/** Stable id for a merged family row (legend, keyed UI). */
export function october7thFamilyRowId(packId: string, familyKey: October7thMergedFamilyKey): string {
  return `${packId}::family:${familyKey}`;
}
