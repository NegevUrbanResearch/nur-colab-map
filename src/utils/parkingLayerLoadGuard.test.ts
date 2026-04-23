import { describe, expect, it } from "vitest";
import { dispositionForParkingLoadResult } from "./parkingLayerLoadGuard";

describe("dispositionForParkingLoadResult", () => {
  it("applies when session is unchanged and layer is still wanted", () => {
    expect(
      dispositionForParkingLoadResult({
        sessionAtStart: 3,
        currentSession: 3,
        layerWanted: true,
      })
    ).toBe("apply");
  });

  it("discards when parking was turned off (session bumped)", () => {
    expect(
      dispositionForParkingLoadResult({
        sessionAtStart: 2,
        currentSession: 3,
        layerWanted: true,
      })
    ).toBe("discard");
  });

  it("discards when layer is no longer wanted even if session matches", () => {
    expect(
      dispositionForParkingLoadResult({
        sessionAtStart: 1,
        currentSession: 1,
        layerWanted: false,
      })
    ).toBe("discard");
  });
});
