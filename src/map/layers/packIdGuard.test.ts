import { describe, expect, it } from "vitest";
import { packFolderIdMatchesManifestId } from "./packIdGuard";

describe("packFolderIdMatchesManifestId", () => {
  it("is true when folder id equals manifest id", () => {
    expect(packFolderIdMatchesManifestId("future_development", "future_development")).toBe(
      true,
    );
  });

  it("is false when ids differ (guard should warn in dev, not in vitest test mode)", () => {
    expect(packFolderIdMatchesManifestId("future_dev", "future_development")).toBe(false);
  });
});
