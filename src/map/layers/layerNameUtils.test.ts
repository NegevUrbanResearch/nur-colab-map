import { describe, expect, it } from "vitest";
import type { LayerManifestEntry } from "./types";
import {
  buildLayerTileRows,
  buildOctober7thActiveLegendRows,
  october7thMergedFamilyKeyFromLayerId,
  packLayerKey,
  parsePackLayerKey,
  pickOctober7thFamilyLayerForSwatch,
} from "./layerNameUtils";

function layer(id: string, name?: string, geometryType: LayerManifestEntry["geometryType"] = "polygon"): LayerManifestEntry {
  return {
    id,
    name: name ?? id,
    file: `${id}.geojson`,
    format: "geojson",
    geometryType,
  };
}

describe("parsePackLayerKey", () => {
  it("round-trips packLayerKey for Hebrew ids", () => {
    const k = packLayerKey("future_development", "חניה");
    expect(parsePackLayerKey(k)).toEqual({ packId: "future_development", layerId: "חניה" });
  });
});

describe("october7thMergedFamilyKeyFromLayerId", () => {
  it("maps geometry variants and line axis ids to shared families", () => {
    expect(october7thMergedFamilyKeyFromLayerId("חדירה_לישוב-אזור")).toBe("חדירה_לישוב");
    expect(october7thMergedFamilyKeyFromLayerId("חדירה_לישוב-ציר")).toBe("חדירה_לישוב");
    expect(october7thMergedFamilyKeyFromLayerId("מאבק_וגבורה_אזור")).toBe("מאבק_וגבורה");
    expect(october7thMergedFamilyKeyFromLayerId("מאבק_וגבורה_ציר")).toBe("מאבק_וגבורה");
    expect(october7thMergedFamilyKeyFromLayerId("פגיעה_נקודתית-נקודה")).toBe("פגיעה_נקודתית");
    expect(october7thMergedFamilyKeyFromLayerId("ביזה-אזור")).toBe("ביזה");
    expect(october7thMergedFamilyKeyFromLayerId("ביזה-נקודה")).toBe("ביזה");
    expect(october7thMergedFamilyKeyFromLayerId("אירוע_נקודתי-רציחה_חטיפה-אזור")).toBe("אירוע_נקודתי-רציחה_חטיפה");
    expect(october7thMergedFamilyKeyFromLayerId("אירוע_נקודתי-רציחה_חטיפה")).toBe("אירוע_נקודתי-רציחה_חטיפה");
  });

  it("does not merge אזור_הרס geometry variants (excluded from merged families until glossary adds a family key)", () => {
    expect(october7thMergedFamilyKeyFromLayerId("אזור_הרס-אזור")).toBeNull();
    expect(october7thMergedFamilyKeyFromLayerId("אזור_הרס-נקודה")).toBeNull();
  });
});

describe("buildLayerTileRows", () => {
  it("leaves non-october packs as one tile per layer", () => {
    const layers = [layer("a"), layer("b")];
    const rows = buildLayerTileRows("greens", layers);
    expect(rows).toEqual([
      { kind: "layer", layer: layers[0]!, label: "a" },
      { kind: "layer", layer: layers[1]!, label: "b" },
    ]);
  });

  it("uses legend fallback normalization for non-family tile labels", () => {
    const rows = buildLayerTileRows("october_7th", [layer("x", "foo_bar_baz")]);
    expect(rows).toEqual([{ kind: "layer", layer: expect.objectContaining({ id: "x" }), label: "foo bar baz" }]);
  });

  it("merges october_7th families in manifest order with all concrete members", () => {
    const layers = [
      layer("ביזה-אזור"),
      layer("ביזה-נקודה"),
      layer("חדירה_לישוב-אזור"),
      layer("חדירה_לישוב-נקודה"),
      layer("חדירה_לישוב-ציר"),
      layer("מאבק_וגבורה_נקודה"),
    ];
    const rows = buildLayerTileRows("october_7th", layers);
    expect(rows.map((r) => r.kind)).toEqual(["family", "family", "family"]);
    const fam0 = rows[0]!;
    expect(fam0.kind).toBe("family");
    if (fam0.kind !== "family") throw new Error("expected family");
    expect(fam0.mergedFamily).toBe("ביזה");
    expect(fam0.members.map((m) => m.id)).toEqual(["ביזה-אזור", "ביזה-נקודה"]);
    const fam1 = rows[1]!;
    expect(fam1.kind).toBe("family");
    if (fam1.kind !== "family") throw new Error("expected family");
    expect(fam1.mergedFamily).toBe("חדירה_לישוב");
    expect(fam1.members.map((m) => m.id)).toEqual(["חדירה_לישוב-אזור", "חדירה_לישוב-נקודה", "חדירה_לישוב-ציר"]);
    const fam2 = rows[2]!;
    expect(fam2.kind).toBe("family");
    if (fam2.kind !== "family") throw new Error("expected family");
    expect(fam2.mergedFamily).toBe("מאבק_וגבורה");
    expect(fam2.members.map((m) => m.id)).toEqual(["מאבק_וגבורה_נקודה"]);
  });
});

describe("buildOctober7thActiveLegendRows", () => {
  it("uses point member style for merged family when point and polygon are both on (not manifest-first polygon)", () => {
    const poly = layer("חדירה_לישוב-אזור", undefined, "polygon");
    const pt = layer("חדירה_לישוב-נקודה", undefined, "point");
    const manifest = [poly, pt];
    const pointStyle = {
      type: "point",
      renderer: "simple",
      defaultSymbol: {
        symbolLayers: [
          {
            type: "markerPoint",
            marker: {
              shape: "circle",
              size: 8,
              fillColor: "#0d47a1",
              strokeColor: "#000000",
              strokeWidth: 1,
            },
          },
        ],
      },
    };
    const polygonStyle = {
      type: "polygon",
      defaultSymbol: {
        symbolLayers: [
          { type: "fill", fillType: "solid", color: "#d76e89", opacity: 0.8 },
          { type: "stroke", color: "#000000", width: 1, opacity: 1, dash: null },
        ],
      },
    };
    const layerOnByKey: Record<string, boolean> = {
      [packLayerKey("october_7th", "חדירה_לישוב-אזור")]: true,
      [packLayerKey("october_7th", "חדירה_לישוב-נקודה")]: true,
    };
    const rows = buildOctober7thActiveLegendRows("october_7th", manifest, layerOnByKey, {
      "חדירה_לישוב-אזור": polygonStyle,
      "חדירה_לישוב-נקודה": pointStyle,
    });
    expect(rows[0]?.swatch?.kind).toBe("point");
    expect(rows[0]?.swatch?.fillColor).toBe("#0d47a1");
    expect(rows[0]?.swatches?.map((s) => s.kind)).toEqual(["point", "polygon"]);
  });

  it("dedupes active geometry variants like the legend model", () => {
    const layers = [layer("חדירה_לישוב-אזור"), layer("חדירה_לישוב-נקודה"), layer("ביזה-אזור")];
    const layerOnByKey: Record<string, boolean> = {
      [packLayerKey("october_7th", "חדירה_לישוב-אזור")]: true,
      [packLayerKey("october_7th", "חדירה_לישוב-נקודה")]: true,
      [packLayerKey("october_7th", "ביזה-אזור")]: false,
    };
    const rows = buildOctober7thActiveLegendRows("october_7th", layers, layerOnByKey, {});
    expect(rows).toEqual([{ id: "october_7th::family:חדירה_לישוב", label: "חדירה לישוב" }]);
  });

  it("merges ביזה geometry variants into one legend row when both are on", () => {
    const layers = [layer("ביזה-אזור", undefined, "polygon"), layer("ביזה-נקודה", undefined, "point")];
    const layerOnByKey: Record<string, boolean> = {
      [packLayerKey("october_7th", "ביזה-אזור")]: true,
      [packLayerKey("october_7th", "ביזה-נקודה")]: true,
    };
    const rows = buildOctober7thActiveLegendRows("october_7th", layers, layerOnByKey, {});
    expect(rows).toEqual([{ id: "october_7th::family:ביזה", label: "ביזה" }]);
  });

  it("merges אירוע_נקודתי variants and uses glossary label", () => {
    const layers = [
      layer("אירוע_נקודתי-רציחה_חטיפה-אזור"),
      layer("אירוע_נקודתי-רציחה_חטיפה"),
    ];
    const layerOnByKey: Record<string, boolean> = {
      [packLayerKey("october_7th", "אירוע_נקודתי-רציחה_חטיפה-אזור")]: true,
      [packLayerKey("october_7th", "אירוע_נקודתי-רציחה_חטיפה")]: true,
    };
    const rows = buildOctober7thActiveLegendRows("october_7th", layers, layerOnByKey, {});
    expect(rows).toEqual([
      {
        id: "october_7th::family:אירוע_נקודתי-רציחה_חטיפה",
        label: "אירוע נקודתי — רציחה וחטיפה",
      },
    ]);
  });

  it("shows a family row when only one variant is on", () => {
    const layers = [layer("מאבק_וגבורה_אזור"), layer("מאבק_וגבורה_נקודה")];
    const layerOnByKey: Record<string, boolean> = {
      [packLayerKey("october_7th", "מאבק_וגבורה_אזור")]: true,
      [packLayerKey("october_7th", "מאבק_וגבורה_נקודה")]: false,
    };
    const rows = buildOctober7thActiveLegendRows("october_7th", layers, layerOnByKey, {});
    expect(rows).toEqual([{ id: "october_7th::family:מאבק_וגבורה", label: "מאבק וגבורה" }]);
  });
});

describe("pickOctober7thFamilyLayerForSwatch", () => {
  it("prefers point over line over polygon, then manifest order", () => {
    const manifest: LayerManifestEntry[] = [
      layer("חדירה_לישוב-אזור", undefined, "polygon"),
      layer("חדירה_לישוב-נקודה", undefined, "point"),
      layer("חדירה_לישוב-ציר", undefined, "line"),
    ];
    const active = [manifest[0]!, manifest[1]!, manifest[2]!];
    expect(pickOctober7thFamilyLayerForSwatch(active, manifest).id).toBe("חדירה_לישוב-נקודה");
  });

  it("uses manifest order when only lines tie", () => {
    const first = layer("f-line-1", undefined, "line");
    const second = layer("f-line-2", undefined, "line");
    const manifest = [first, second];
    expect(pickOctober7thFamilyLayerForSwatch([second, first], manifest).id).toBe("f-line-1");
  });
});
