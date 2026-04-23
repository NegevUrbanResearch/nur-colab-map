import { describe, expect, it } from "vitest";
import { addLayerAssetBasenamesFromGlobKeys } from "./assetIndex";

describe("addLayerAssetBasenamesFromGlobKeys", () => {
  it("collects basenames for flat pack paths", () => {
    const map = addLayerAssetBasenamesFromGlobKeys([
      "../../assets/layers/pack1/foo.pmtiles",
      "../../assets/layers/pack1/bar.geojson",
    ]);
    expect([...(map.get("pack1") ?? new Set())].sort()).toEqual(
      ["bar.geojson", "foo.pmtiles"].sort(),
    );
  });

  it("collects basenames for nested files under a pack (not only one level deep)", () => {
    const map = addLayerAssetBasenamesFromGlobKeys([
      "../../assets/layers/greens/sub/שמורות_טבע.pmtiles",
      "../../assets/layers/greens/יער_טבעי.pmtiles",
    ]);
    const set = map.get("greens");
    expect(set?.has("שמורות_טבע.pmtiles")).toBe(true);
    expect(set?.has("יער_טבעי.pmtiles")).toBe(true);
  });

  it("skips manifest.json and styles.json by basename", () => {
    const map = addLayerAssetBasenamesFromGlobKeys([
      "../../assets/layers/p/manifest.json",
      "../../assets/layers/p/nested/manifest.json",
      "../../assets/layers/p/x.geojson",
    ]);
    const set = map.get("p");
    expect(set?.has("manifest.json")).toBe(false);
    expect(set?.has("x.geojson")).toBe(true);
  });
});
