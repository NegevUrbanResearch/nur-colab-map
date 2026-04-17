import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../supabase/cityscopeSync", () => ({
  notifyCityscopeSubmissionUpdated: vi.fn().mockResolvedValue(undefined),
}));

import * as cityscopeSync from "../../supabase/cityscopeSync";
import { triggerCityscopeSyncAfterSubmissionSave } from "./postSubmissionCityscope";

describe("triggerCityscopeSyncAfterSubmissionSave", () => {
  beforeEach(() => {
    vi.mocked(cityscopeSync.notifyCityscopeSubmissionUpdated).mockClear();
  });

  it("delegates to notifyCityscopeSubmissionUpdated", () => {
    triggerCityscopeSyncAfterSubmissionSave("33333333-3333-3333-3333-333333333333");
    expect(cityscopeSync.notifyCityscopeSubmissionUpdated).toHaveBeenCalledTimes(1);
    expect(cityscopeSync.notifyCityscopeSubmissionUpdated).toHaveBeenCalledWith({
      submissionId: "33333333-3333-3333-3333-333333333333",
      table: "otef",
    });
  });
});
