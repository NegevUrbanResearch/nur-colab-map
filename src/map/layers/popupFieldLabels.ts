/** Hebrew / human-friendly labels for common manifest and GIS property keys. */

const HEBREW_CHAR = /[\u0590-\u05FF]/;

/** Normalized lookup: lowercase, underscores preserved. */
const LABEL_BY_NORMALIZED_KEY: Record<string, string> = {
  name: "שם",
  names: "שמות",
  names_he: "שמות (עברית)",
  names_en: "שמות (אנגלית)",
  site_name: "שם אתר",
  sitename: "שם אתר",
  setl_name: "שם יישוב",
  settlement: "יישוב",
  yishuv: "יישוב",
  general_de: "תיאור כללי",
  description: "תיאור",
  desc: "תיאור",
  site_type: "סוג אתר",
  type: "סוג",
  oct7_desc: "תיאור (7 באוקטובר)",
  address: "כתובת",
  street: "רחוב",
  municipality: "רשות מקומית",
  region: "אזור",
  notes: "הערות",
  comment: "הערה",
  id: "מזהה",
  fid: "מזהה",
  objectid: "מזהה",
  area: "שטח",
  length: "אורך",
  population: "אוכלוסייה",
  year: "שנה",
  date: "תאריך",
  status: "סטטוס",
  operator: "מפעיל",
  owner: "בעלות",
};

function normalizeFieldKey(key: string): string {
  return key.trim().toLowerCase().replace(/\s+/g, "_");
}

function labelFromKeyMap(key: string): string | undefined {
  const direct = LABEL_BY_NORMALIZED_KEY[key];
  if (direct) return direct;
  return LABEL_BY_NORMALIZED_KEY[normalizeFieldKey(key)];
}

/**
 * Resolves the display label for a popup row: Hebrew catalog, explicit manifest label, or a mild humanization of the key.
 */
export function resolvePopupFieldLabel(key: string, explicitLabel?: string): string {
  const trimmedExplicit = explicitLabel?.trim();
  if (trimmedExplicit && HEBREW_CHAR.test(trimmedExplicit)) {
    return trimmedExplicit;
  }
  const mapped = labelFromKeyMap(key);
  if (mapped) return mapped;
  if (trimmedExplicit) return trimmedExplicit;
  return key.replace(/_/g, " ").trim() || key;
}
