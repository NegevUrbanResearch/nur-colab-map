import { describe, expect, it } from "vitest";
import { buildLayerRegistry } from "./layerRegistry";

describe("buildLayerRegistry", () => {
  it("loads all local layer packs with styles", async () => {
    const registry = await buildLayerRegistry();
    expect(registry.packs.length).toBeGreaterThan(0);
    const futureDev = registry.packs.find((p) => p.id === "future_development");
    expect(futureDev).toBeTruthy();
    expect(Object.keys(futureDev!.styles).length).toBeGreaterThan(0);
  });
});
