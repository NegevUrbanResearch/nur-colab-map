/** Curated Hebrew display labels for merged October 7th geometry-variant families. */

import type { LayerPackManifest } from "./types";

export const OCTOBER_7TH_PACK_ID = "october_7th" as const;

/** Hebrew UI labels for layer packs (keys are stable pack ids; manifest `name` may stay English). */
export const LAYER_PACK_DISPLAY_NAME_HE: Readonly<Record<string, string>> = {
  future_development: "פיתוח עתידי",
  greens: "שטחים ירוקים",
  october_7th: "אירועי 7 באוקטובר",
  muniplicity_transport: "תחבורה עירונית",
};

export function layerPackDisplayNameHe(packId: string, manifest: LayerPackManifest): string {
  return LAYER_PACK_DISPLAY_NAME_HE[packId] ?? manifest.name;
}

export type October7thMergedFamilyKey =
  | "חדירה_לישוב"
  | "מאבק_וגבורה"
  | "פגיעה_נקודתית"
  | "ביזה"
  | "אזור_הרס"
  | `אירוע_נקודתי-${string}`;

const OCTOBER_MERGED_FAMILY_LABEL: Partial<Record<string, string>> = {
  חדירה_לישוב: "חדירה לישוב",
  מאבק_וגבורה: "מאבק וגבורה",
  פגיעה_נקודתית: "פגיעה נקודתית",
  ביזה: "ביזה",
  אזור_הרס: "אזור הרס",
  "אירוע_נקודתי-רציחה_חטיפה": "אירוע נקודתי — רציחה וחטיפה",
};

/** Human-readable legend/tile label from technical layer ids (underscores and hyphens → spaces). */
export function normalizeLegendFallbackLabel(technical: string): string {
  return technical
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function october7thMergedFamilyLabel(familyKey: October7thMergedFamilyKey): string {
  const curated = OCTOBER_MERGED_FAMILY_LABEL[familyKey];
  if (curated != null) return curated;
  return normalizeLegendFallbackLabel(familyKey);
}

/** Stable id for a merged family row (legend, keyed UI). */
export function october7thFamilyRowId(packId: string, familyKey: October7thMergedFamilyKey): string {
  return `${packId}::family:${familyKey}`;
}
