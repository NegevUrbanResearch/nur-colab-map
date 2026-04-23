import { describe, expect, it } from "vitest";
import {
  getLayerKey,
  nextLayerStateAfterPackToggle,
  nextLayerStateAfterLayerToggle,
  packAggregateFromLayerBooleans,
  reconcileLayerOnByKeyWithRegistry,
} from "./useLayerPackState";
import { packLayerKey } from "../../map/layers/layerNameUtils";
import type { LayerRegistry } from "../../map/layers/types";

const mockRegistry: LayerRegistry = {
  packs: [
    {
      id: "pack_a",
      name: "חבילה א",
      displayName: "חבילה א",
      manifest: {
        id: "pack_a",
        name: "חבילה א",
        layers: [
          { id: "L1", name: "שכבה 1", file: "a.geojson", format: "geojson", geometryType: "line" },
          { id: "L2", name: "שכבה 2", file: "b.geojson", format: "geojson", geometryType: "polygon" },
        ],
      },
      styles: {},
    },
    {
      id: "pack_b",
      name: "חבילה ב",
      displayName: "חבילה ב",
      manifest: {
        id: "pack_b",
        name: "חבילה ב",
        layers: [{ id: "X1", name: "שכבה x", file: "c.geojson", format: "geojson", geometryType: "point" }],
      },
      styles: {},
    },
  ],
  getLayer: () => undefined,
};

describe("packAggregateFromLayerBooleans (pack / tile family aggregate sync)", () => {
  it('returns "off" for empty or all-false', () => {
    expect(packAggregateFromLayerBooleans([])).toBe("off");
    expect(packAggregateFromLayerBooleans([false, false])).toBe("off");
  });

  it('returns "on" only when every layer is on', () => {
    expect(packAggregateFromLayerBooleans([true])).toBe("on");
    expect(packAggregateFromLayerBooleans([true, true])).toBe("on");
  });

  it('returns "partial" when some but not all are on', () => {
    expect(packAggregateFromLayerBooleans([true, false])).toBe("partial");
    expect(packAggregateFromLayerBooleans([false, true, false])).toBe("partial");
  });

  it("merged-family row: aggregate tracks partial → on → off like LayerTilesGrid familyAggregate", () => {
    const memberIds = ["חדירה_לישוב-אזור", "חדירה_לישוב-נקודה"] as const;
    const octoberPack: LayerRegistry = {
      packs: [
        {
          id: "october_7th",
          name: "Oct",
          displayName: "Oct",
          manifest: {
            id: "october_7th",
            name: "Oct",
            layers: [
              { id: "חדירה_לישוב-אזור", name: "a", file: "a.geojson", format: "geojson", geometryType: "polygon" },
              { id: "חדירה_לישוב-נקודה", name: "b", file: "b.geojson", format: "geojson", geometryType: "point" },
              { id: "ביזה-אזור", name: "c", file: "c.geojson", format: "geojson", geometryType: "polygon" },
            ],
          },
          styles: {},
        },
      ],
      getLayer: () => undefined,
    };
    const familyAgg = (m: Record<string, boolean>) =>
      packAggregateFromLayerBooleans(memberIds.map((id) => m[packLayerKey("october_7th", id)] === true));

    const kArea = packLayerKey("october_7th", "חדירה_לישוב-אזור");
    const kPoint = packLayerKey("october_7th", "חדירה_לישוב-נקודה");
    const kOther = packLayerKey("october_7th", "ביזה-אזור");
    let m: Record<string, boolean> = { [kArea]: true, [kPoint]: false, [kOther]: false };
    expect(familyAgg(m)).toBe("partial");

    m = nextLayerStateAfterPackToggle(m, "october_7th", [...memberIds], octoberPack);
    expect(familyAgg(m)).toBe("on");
    expect(m[kOther]).toBe(false);

    m = nextLayerStateAfterPackToggle(m, "october_7th", [...memberIds], octoberPack);
    expect(familyAgg(m)).toBe("off");
    expect(m[kOther]).toBe(false);
  });
});

describe("useLayerPackState helpers", () => {
  it("toggles full pack: off → all on → all off", () => {
    const layerKeys = ["L1", "L2"].map((id) => getLayerKey("pack_a", id));
    let m: Record<string, boolean> = {};
    m = nextLayerStateAfterPackToggle(m, "pack_a", ["L1", "L2"], mockRegistry);
    expect(m[layerKeys[0]!]).toBe(true);
    expect(m[layerKeys[1]!]).toBe(true);
    m = nextLayerStateAfterPackToggle(m, "pack_a", ["L1", "L2"], mockRegistry);
    expect(m[layerKeys[0]!]).toBe(false);
    expect(m[layerKeys[1]!]).toBe(false);
  });

  it("supports per-layer toggle and reports partial state for a pack", () => {
    const k0 = getLayerKey("pack_a", "L1");
    const k1 = getLayerKey("pack_a", "L2");
    let m: Record<string, boolean> = { [k0]: true, [k1]: true };
    m = nextLayerStateAfterLayerToggle(m, "pack_a", "L1", false, mockRegistry);
    const layerIds = ["L1", "L2"] as const;
    const state = (ids: readonly string[]) =>
      packAggregateFromLayerBooleans(ids.map((id) => m[getLayerKey("pack_a", id)] === true));
    expect(state(layerIds)).toBe("partial");
  });

  it("treats partial the same as off for pack master: next click turns all on", () => {
    const k0 = getLayerKey("pack_a", "L1");
    const k1 = getLayerKey("pack_a", "L2");
    let m: Record<string, boolean> = { [k0]: true, [k1]: false };
    m = nextLayerStateAfterPackToggle(m, "pack_a", ["L1", "L2"], mockRegistry);
    expect(m[k0]).toBe(true);
    expect(m[k1]).toBe(true);
  });

  it("pack master toggle only updates keys for that pack", () => {
    let m: Record<string, boolean> = {};
    m = nextLayerStateAfterPackToggle(m, "pack_a", ["L1", "L2"], mockRegistry);
    expect(m[getLayerKey("pack_b", "X1")]).toBeUndefined();
    m = nextLayerStateAfterPackToggle(m, "pack_b", ["X1"], mockRegistry);
    expect(m[getLayerKey("pack_b", "X1")]).toBe(true);
    expect(m[getLayerKey("pack_a", "L1")]).toBe(true);
  });

  it("defaults future_development::חניה on when the key first appears in the registry", () => {
    const parkingKey = packLayerKey("future_development", "חניה");
    const registryWithParking: LayerRegistry = {
      packs: [
        {
          id: "future_development",
          name: "Future",
          displayName: "Future",
          manifest: {
            id: "future_development",
            name: "Future",
            layers: [
              { id: "חניה", name: "Parking", file: "p.geojson", format: "geojson", geometryType: "point" },
            ],
          },
          styles: {},
        },
      ],
      getLayer: () => undefined,
    };
    const prev: Record<string, boolean> = {};
    const next = reconcileLayerOnByKeyWithRegistry(prev, registryWithParking);
    expect(next[parkingKey]).toBe(true);
  });

  it("reconcileLayerOnByKeyWithRegistry keeps parking off when the user explicitly turned it off", () => {
    const parkingKey = packLayerKey("future_development", "חניה");
    const registryWithParking: LayerRegistry = {
      packs: [
        {
          id: "future_development",
          name: "Future",
          displayName: "Future",
          manifest: {
            id: "future_development",
            name: "Future",
            layers: [
              { id: "חניה", name: "Parking", file: "p.geojson", format: "geojson", geometryType: "point" },
            ],
          },
          styles: {},
        },
      ],
      getLayer: () => undefined,
    };
    const prev: Record<string, boolean> = { [parkingKey]: false };
    const next = reconcileLayerOnByKeyWithRegistry(prev, registryWithParking);
    expect(next[parkingKey]).toBe(false);
  });

  it("reconcileLayerOnByKeyWithRegistry removes stale keys so true count matches current registry", () => {
    const staleKey = "removed_pack::old_layer";
    const prev: Record<string, boolean> = {
      [staleKey]: true,
      [getLayerKey("pack_a", "L1")]: true,
      [getLayerKey("pack_a", "L2")]: false,
      [getLayerKey("pack_b", "X1")]: true,
    };
    const reconciled = reconcileLayerOnByKeyWithRegistry(prev, mockRegistry);
    expect(reconciled[staleKey]).toBeUndefined();
    expect(Object.values(reconciled).filter(Boolean).length).toBe(2);
    expect(reconciled[getLayerKey("pack_a", "L1")]).toBe(true);
    expect(reconciled[getLayerKey("pack_a", "L2")]).toBe(false);
    expect(reconciled[getLayerKey("pack_b", "X1")]).toBe(true);
  });
});
