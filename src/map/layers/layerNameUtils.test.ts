import { describe, expect, it } from "vitest";
import type { LayerManifestEntry } from "./types";
import {
  buildLayerTileRows,
  buildOctober7thActiveLegendRows,
  october7thMergedFamilyKeyFromLayerId,
  packLayerKey,
} from "./layerNameUtils";

function layer(id: string, name?: string): LayerManifestEntry {
  return {
    id,
    name: name ?? id,
    file: `${id}.geojson`,
    format: "geojson",
    geometryType: "polygon",
  };
}

describe("october7thMergedFamilyKeyFromLayerId", () => {
  it("maps geometry variants and line axis ids to shared families", () => {
    expect(october7thMergedFamilyKeyFromLayerId("חדירה_לישוב-אזור")).toBe("חדירה_לישוב");
    expect(october7thMergedFamilyKeyFromLayerId("חדירה_לישוב-ציר")).toBe("חדירה_לישוב");
    expect(october7thMergedFamilyKeyFromLayerId("מאבק_וגבורה_אזור")).toBe("מאבק_וגבורה");
    expect(october7thMergedFamilyKeyFromLayerId("מאבק_וגבורה_ציר")).toBe("מאבק_וגבורה");
    expect(october7thMergedFamilyKeyFromLayerId("פגיעה_נקודתית-נקודה")).toBe("פגיעה_נקודתית");
    expect(october7thMergedFamilyKeyFromLayerId("ביזה-אזור")).toBeNull();
  });
});

describe("buildLayerTileRows", () => {
  it("leaves non-october packs as one tile per layer", () => {
    const layers = [layer("a"), layer("b")];
    const rows = buildLayerTileRows("greens", layers);
    expect(rows).toEqual([
      { kind: "layer", layer: layers[0]! },
      { kind: "layer", layer: layers[1]! },
    ]);
  });

  it("merges october_7th families in manifest order with all concrete members", () => {
    const layers = [
      layer("ביזה-אזור"),
      layer("חדירה_לישוב-אזור"),
      layer("חדירה_לישוב-נקודה"),
      layer("חדירה_לישוב-ציר"),
      layer("מאבק_וגבורה_נקודה"),
    ];
    const rows = buildLayerTileRows("october_7th", layers);
    expect(rows.map((r) => r.kind)).toEqual(["layer", "family", "family"]);
    const fam0 = rows[1]!;
    expect(fam0.kind).toBe("family");
    if (fam0.kind !== "family") throw new Error("expected family");
    expect(fam0.familyKey).toBe("חדירה_לישוב");
    expect(fam0.members.map((m) => m.id)).toEqual(["חדירה_לישוב-אזור", "חדירה_לישוב-נקודה", "חדירה_לישוב-ציר"]);
    const fam1 = rows[2]!;
    expect(fam1.kind).toBe("family");
    if (fam1.kind !== "family") throw new Error("expected family");
    expect(fam1.familyKey).toBe("מאבק_וגבורה");
    expect(fam1.members.map((m) => m.id)).toEqual(["מאבק_וגבורה_נקודה"]);
  });
});

describe("buildOctober7thActiveLegendRows", () => {
  it("dedupes active geometry variants like the legend model", () => {
    const layers = [layer("חדירה_לישוב-אזור"), layer("חדירה_לישוב-נקודה"), layer("ביזה-אזור")];
    const layerOnByKey: Record<string, boolean> = {
      [packLayerKey("october_7th", "חדירה_לישוב-אזור")]: true,
      [packLayerKey("october_7th", "חדירה_לישוב-נקודה")]: true,
      [packLayerKey("october_7th", "ביזה-אזור")]: false,
    };
    const rows = buildOctober7thActiveLegendRows("october_7th", layers, layerOnByKey);
    expect(rows).toEqual([{ id: "october_7th::family:חדירה_לישוב", label: "חדירה לישוב" }]);
  });

  it("shows a family row when only one variant is on", () => {
    const layers = [layer("מאבק_וגבורה_אזור"), layer("מאבק_וגבורה_נקודה")];
    const layerOnByKey: Record<string, boolean> = {
      [packLayerKey("october_7th", "מאבק_וגבורה_אזור")]: true,
      [packLayerKey("october_7th", "מאבק_וגבורה_נקודה")]: false,
    };
    const rows = buildOctober7thActiveLegendRows("october_7th", layers, layerOnByKey);
    expect(rows).toEqual([{ id: "october_7th::family:מאבק_וגבורה", label: "מאבק וגבורה" }]);
  });
});
