import { beforeEach, describe, expect, it, vi } from "vitest";
import * as assetIndex from "./assetIndex";
import { LAYER_PACK_DISPLAY_NAME_HE } from "./layerDisplayGlossary";
import { buildLayerRegistry } from "./layerRegistry";
import type { LayerManifestEntry, LayerPackManifest } from "./types";

vi.mock("./assetIndex", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./assetIndex")>();
  return {
    ...actual,
    getManifestLoadersByPackId: vi.fn(actual.getManifestLoadersByPackId),
    getStylesLoadersByPackId: vi.fn(actual.getStylesLoadersByPackId),
    getLayerAssetBasenamesByPackId: vi.fn(actual.getLayerAssetBasenamesByPackId),
  };
});

function manifestEntry(partial: Pick<LayerManifestEntry, "id" | "file"> & Partial<LayerManifestEntry>): LayerManifestEntry {
  return {
    name: partial.name ?? partial.id,
    format: partial.format ?? "geojson",
    geometryType: partial.geometryType ?? "polygon",
    ...partial,
  };
}

describe("buildLayerRegistry", () => {
  beforeEach(async () => {
    const actual = await vi.importActual<typeof import("./assetIndex")>("./assetIndex");
    vi.mocked(assetIndex.getManifestLoadersByPackId).mockImplementation(actual.getManifestLoadersByPackId);
    vi.mocked(assetIndex.getStylesLoadersByPackId).mockImplementation(actual.getStylesLoadersByPackId);
    vi.mocked(assetIndex.getLayerAssetBasenamesByPackId).mockImplementation(actual.getLayerAssetBasenamesByPackId);
  });

  it("loads all local layer packs with styles", async () => {
    const registry = await buildLayerRegistry();
    expect(registry.packs.length).toBeGreaterThan(0);
    const futureDev = registry.packs.find((p) => p.id === "future_development");
    expect(futureDev).toBeTruthy();
    expect(futureDev!.displayName).toBe(LAYER_PACK_DISPLAY_NAME_HE.future_development);
    expect(Object.keys(futureDev!.styles).length).toBeGreaterThan(0);
  });

  it("contains parking as a controllable future_development layer", async () => {
    const registry = await buildLayerRegistry();
    expect(registry.getLayer("future_development", "חניה")).toBeTruthy();
  });

  it("omits layers when neither GeoJSON nor PMTiles basenames exist on disk", async () => {
    const registry = await buildLayerRegistry();
    expect(registry.getLayer("future_development", "מימושים")).toBeUndefined();
  });

  it("aggregates unresolvable layers into exactly one warning per affected pack (mocked assets)", async () => {
    const summaries: string[] = [];
    const manifestPartial: LayerPackManifest = {
      id: "pack_alpha",
      name: "Alpha",
      layers: [
        manifestEntry({ id: "keep", file: "present.geojson" }),
        manifestEntry({ id: "drop_a", file: "missing_a.geojson" }),
        manifestEntry({ id: "drop_b", file: "missing_b.geojson" }),
      ],
    };
    const manifestAllBad: LayerPackManifest = {
      id: "pack_beta",
      name: "Beta",
      layers: [
        manifestEntry({ id: "only_bad_1", file: "ghost1.geojson" }),
        manifestEntry({ id: "only_bad_2", file: "ghost2.geojson" }),
      ],
    };

    const manifestLoaders = new Map<string, () => Promise<{ default: LayerPackManifest }>>([
      ["pack_alpha", async () => ({ default: manifestPartial })],
      ["pack_beta", async () => ({ default: manifestAllBad })],
    ]);
    const stylesLoaders = new Map<string, () => Promise<{ default: Record<string, unknown> }>>([
      ["pack_alpha", async () => ({ default: {} })],
      ["pack_beta", async () => ({ default: {} })],
    ]);
    const basenamesByPack = new Map<string, Set<string>>([
      ["pack_alpha", new Set(["present.geojson"])],
      ["pack_beta", new Set()],
    ]);

    vi.mocked(assetIndex.getManifestLoadersByPackId).mockImplementation(() => manifestLoaders);
    vi.mocked(assetIndex.getStylesLoadersByPackId).mockImplementation(() => stylesLoaders);
    vi.mocked(assetIndex.getLayerAssetBasenamesByPackId).mockImplementation(() => basenamesByPack);

    const registry = await buildLayerRegistry({
      onRegistryWarn: (message) => summaries.push(message),
    });

    expect(registry.packs).toHaveLength(1);
    expect(registry.packs[0]!.id).toBe("pack_alpha");
    expect(registry.packs[0]!.manifest.layers.map((l) => l.id)).toEqual(["keep"]);

    expect(summaries).toHaveLength(2);

    const byPack = summaries.map((m) => {
      const id = m.match(/\bpack=([^\s]+)\b/)?.[1];
      expect(id, `expected pack= in summary: ${m}`).toBeTruthy();
      return { id: id!, m };
    });
    expect(new Set(byPack.map((x) => x.id)).size).toBe(2);

    const alpha = byPack.find((x) => x.id === "pack_alpha")!.m;
    const beta = byPack.find((x) => x.id === "pack_beta")!.m;

    expect(alpha).toMatch(/^\[layerRegistry\] Skipped 2 unresolvable layer\(s\)/);
    expect(alpha).toContain("drop_a");
    expect(alpha).toContain("drop_b");
    expect(beta).toMatch(/^\[layerRegistry\] Skipping pack "pack_beta"/);
    expect(beta).toContain("2 unresolvable entries");
    expect(beta).toContain("only_bad_1");
    expect(beta).toContain("only_bad_2");

    for (const m of summaries) {
      expect(m.startsWith("[layerRegistry] ")).toBe(true);
      expect(m).not.toMatch(/\blayer=[^\s]/);
    }
  });
});
