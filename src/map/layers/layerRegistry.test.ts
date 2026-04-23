import { describe, expect, it } from "vitest";
import { LAYER_PACK_DISPLAY_NAME_HE } from "./layerDisplayGlossary";
import { buildLayerRegistry } from "./layerRegistry";

describe("buildLayerRegistry", () => {
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
});
