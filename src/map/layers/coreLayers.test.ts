import { describe, expect, it } from "vitest";
import { getCoreLayerUrls } from "./coreLayers";

describe("getCoreLayerUrls", () => {
  it("resolves heritage and parking assets under Vite /assets/ paths, not public line-layer", () => {
    const urls = getCoreLayerUrls();

    expect(urls.heritageAxis).toContain("/assets/");
    expect(urls.heritageAxis).not.toContain("line-layer");

    expect(urls.parkingLots).toContain("/assets/");
    expect(urls.parkingLots).not.toContain("line-layer");

    expect(urls.parkingIcon).toContain("/assets/");
    expect(urls.parkingIcon).not.toContain("line-layer");
  });
});
