export async function notifyCityscopeSubmissionUpdated(params: {
  submissionId: string;
  table?: string;
}): Promise<void> {
  const baseUrl = import.meta.env.VITE_CITYSCOPE_BASE_URL;
  if (!baseUrl) return;

  const token = import.meta.env.VITE_CITYSCOPE_SYNC_TOKEN;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const url = new URL("/api/supabase/curated/sync-submission/", baseUrl).toString();
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        table: params.table ?? "otef",
        submission_id: params.submissionId,
      }),
    });
    if (!res.ok) {
      console.error("Cityscope sync failed:", res.status, await res.text().catch(() => ""));
    }
  } catch (err) {
    console.error("Cityscope sync error:", err);
  }
}
