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
