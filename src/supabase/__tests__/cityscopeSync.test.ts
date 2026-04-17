import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { notifyCityscopeSubmissionUpdated } from "../cityscopeSync";

describe("notifyCityscopeSubmissionUpdated", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv("VITE_CITYSCOPE_BASE_URL", "https://cityscope.test");
    vi.stubEnv("VITE_CITYSCOPE_SYNC_TOKEN", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("posts submission_id to cityscope sync endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    } as Response);
    vi.stubGlobal("fetch", fetchMock);

    await notifyCityscopeSubmissionUpdated({
      submissionId: "11111111-1111-1111-1111-111111111111",
      table: "otef",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/supabase/curated/sync-submission/");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ "Content-Type": "application/json" });
    expect(JSON.parse(String(init.body))).toEqual({
      table: "otef",
      submission_id: "11111111-1111-1111-1111-111111111111",
    });
  });

  it("adds Authorization Bearer when VITE_CITYSCOPE_SYNC_TOKEN is set", async () => {
    vi.stubEnv("VITE_CITYSCOPE_SYNC_TOKEN", "secret");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    vi.stubGlobal("fetch", fetchMock);

    await notifyCityscopeSubmissionUpdated({
      submissionId: "22222222-2222-2222-2222-222222222222",
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer secret");
  });
});
