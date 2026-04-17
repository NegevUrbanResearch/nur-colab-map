import { notifyCityscopeSubmissionUpdated } from "../../supabase/cityscopeSync";

export function triggerCityscopeSyncAfterSubmissionSave(submissionId: string): void {
  void notifyCityscopeSubmissionUpdated({ submissionId, table: "otef" });
}
