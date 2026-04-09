import { GeoJSON } from "geojson";
import supabase from ".";
import type { MemorialFeatureType, PendingSite } from "./memorialSites";

/** Matches `PendingPinkNode` in MapPage (`tempId` is stable per geo_feature row for hydration). */
export interface SubmissionBatchPinkNodeState {
  tempId: string;
  name: string | null;
  description: string | null;
  lat: number;
  lng: number;
}

export interface SubmissionBatchSummary {
  submissionId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  pinkNodeCount: number;
  memorialCentralCount: number;
  memorialLocalCount: number;
}

export interface SubmissionBatchDetail {
  submissionId: string;
  name: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  pinkNodes: SubmissionBatchPinkNodeState[];
  centralSite: PendingSite | null;
  localSites: PendingSite[];
}

export type MapSubmissionListContext = {
  activeProject: "pink" | "memorial";
  pinkProjectId: string | null;
  memorialProjectId: string | null;
};

export type MapWorkspaceProjectIds = {
  pinkProjectId: string | null;
  memorialProjectId: string | null;
};

type SubmissionBatchListRow = {
  submission_id: string;
  submission_name: string;
  created_at: string;
  updated_at: string;
};

type SubmissionBatchRow = SubmissionBatchListRow & {
  created_by: string;
};

type GeoFeatureCountRow = {
  submission_id: string;
  project_id: string;
  feature_type: string | null;
};

function isLegacyOrTaggedPinkNode(featureType: string | null): boolean {
  return featureType === null || featureType === "pink_line_node";
}

/** PostgREST default row cap; paginate reads to avoid truncated lists and wrong counts. */
const GEO_FEATURES_PAGE_SIZE = 1000;

async function fetchAllGeoFeaturePages<T>(
  run: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const acc: T[] = [];
  let offset = 0;
  for (;;) {
    const from = offset;
    const to = offset + GEO_FEATURES_PAGE_SIZE - 1;
    const { data, error } = await run(from, to);
    if (error) throw error;
    const page = data ?? [];
    acc.push(...page);
    if (page.length < GEO_FEATURES_PAGE_SIZE) break;
    offset += GEO_FEATURES_PAGE_SIZE;
  }
  return acc;
}

function emptySummaryCounts() {
  return {
    pinkNodeCount: 0,
    memorialCentralCount: 0,
    memorialLocalCount: 0,
  };
}

function filterProjectIdForListContext(ctx: MapSubmissionListContext): string | null {
  if (ctx.activeProject === "pink") return ctx.pinkProjectId;
  return ctx.memorialProjectId;
}

/**
 * Lists submission batches that have at least one feature in the active MapPage project
 * (pink vs memorial tab), ordered by batch `updated_at` descending.
 */
export async function listSubmissionBatchSummariesForMapContext(
  ctx: MapSubmissionListContext
): Promise<SubmissionBatchSummary[]> {
  const projectId = filterProjectIdForListContext(ctx);
  if (!projectId) return [];

  const idRows = await fetchAllGeoFeaturePages<{ submission_id: string | null }>((from, to) =>
    supabase
      .from("geo_features")
      .select("submission_id")
      .eq("project_id", projectId)
      .not("submission_id", "is", null)
      .order("id", { ascending: true })
      .range(from, to)
  );

  const submissionIds = [
    ...new Set(idRows.map((r) => r.submission_id).filter((id): id is string => Boolean(id))),
  ];

  if (submissionIds.length === 0) return [];

  const { data: batchRows, error: batchErr } = await supabase
    .from("submission_batches")
    .select("submission_id, submission_name, created_at, updated_at")
    .in("submission_id", submissionIds)
    .order("updated_at", { ascending: false });

  if (batchErr) throw batchErr;

  const orderedIds = (batchRows ?? []).map((r: SubmissionBatchListRow) => r.submission_id);

  if (orderedIds.length === 0) return [];

  const countRows = await fetchAllGeoFeaturePages<GeoFeatureCountRow>((from, to) =>
    supabase
      .from("geo_features")
      .select("submission_id, project_id, feature_type")
      .in("submission_id", orderedIds)
      .not("submission_id", "is", null)
      .order("id", { ascending: true })
      .range(from, to)
  );

  const countMap = new Map<string, ReturnType<typeof emptySummaryCounts>>();
  for (const sid of orderedIds) countMap.set(sid, emptySummaryCounts());

  const { pinkProjectId, memorialProjectId } = ctx;
  for (const row of countRows) {
    const r = row;
    const bucket = countMap.get(r.submission_id);
    if (!bucket) continue;

    if (pinkProjectId && r.project_id === pinkProjectId) {
      if (r.feature_type === "pink_line_route") continue;
      bucket.pinkNodeCount += 1;
    } else if (memorialProjectId && r.project_id === memorialProjectId) {
      if (r.feature_type === "central") bucket.memorialCentralCount += 1;
      else if (r.feature_type === "local") bucket.memorialLocalCount += 1;
    }
  }

  return (batchRows ?? []).map((raw: SubmissionBatchListRow) => {
    const counts = countMap.get(raw.submission_id) ?? emptySummaryCounts();
    return {
      submissionId: raw.submission_id,
      name: raw.submission_name,
      createdAt: raw.created_at,
      updatedAt: raw.updated_at,
      pinkNodeCount: counts.pinkNodeCount,
      memorialCentralCount: counts.memorialCentralCount,
      memorialLocalCount: counts.memorialLocalCount,
    };
  });
}

/**
 * Lists submission batches that have at least one feature in either workspace project
 * (pink line and/or memorial), ordered by batch `updated_at` descending.
 * Stable when switching MapPage active project tab; does not depend on `activeProject`.
 */
export async function listSubmissionBatchSummariesForWorkspace(
  ctx: MapWorkspaceProjectIds
): Promise<SubmissionBatchSummary[]> {
  const { pinkProjectId, memorialProjectId } = ctx;
  const projectIds = [pinkProjectId, memorialProjectId].filter((id): id is string => Boolean(id));
  if (projectIds.length === 0) return [];

  const idRows = await fetchAllGeoFeaturePages<{ submission_id: string | null }>((from, to) =>
    supabase
      .from("geo_features")
      .select("submission_id")
      .in("project_id", projectIds)
      .not("submission_id", "is", null)
      .order("id", { ascending: true })
      .range(from, to)
  );

  const submissionIds = [
    ...new Set(idRows.map((r) => r.submission_id).filter((id): id is string => Boolean(id))),
  ];

  if (submissionIds.length === 0) return [];

  const { data: batchRows, error: batchErr } = await supabase
    .from("submission_batches")
    .select("submission_id, submission_name, created_at, updated_at")
    .in("submission_id", submissionIds)
    .order("updated_at", { ascending: false });

  if (batchErr) throw batchErr;

  const orderedIds = (batchRows ?? []).map((r: SubmissionBatchListRow) => r.submission_id);

  if (orderedIds.length === 0) return [];

  const countRows = await fetchAllGeoFeaturePages<GeoFeatureCountRow>((from, to) =>
    supabase
      .from("geo_features")
      .select("submission_id, project_id, feature_type")
      .in("submission_id", orderedIds)
      .not("submission_id", "is", null)
      .order("id", { ascending: true })
      .range(from, to)
  );

  const countMap = new Map<string, ReturnType<typeof emptySummaryCounts>>();
  for (const sid of orderedIds) countMap.set(sid, emptySummaryCounts());

  for (const row of countRows) {
    const r = row;
    const bucket = countMap.get(r.submission_id);
    if (!bucket) continue;

    if (pinkProjectId && r.project_id === pinkProjectId) {
      if (r.feature_type === "pink_line_route") continue;
      bucket.pinkNodeCount += 1;
    } else if (memorialProjectId && r.project_id === memorialProjectId) {
      if (r.feature_type === "central") bucket.memorialCentralCount += 1;
      else if (r.feature_type === "local") bucket.memorialLocalCount += 1;
    }
  }

  return (batchRows ?? []).map((raw: SubmissionBatchListRow) => {
    const counts = countMap.get(raw.submission_id) ?? emptySummaryCounts();
    return {
      submissionId: raw.submission_id,
      name: raw.submission_name,
      createdAt: raw.created_at,
      updatedAt: raw.updated_at,
      pinkNodeCount: counts.pinkNodeCount,
      memorialCentralCount: counts.memorialCentralCount,
      memorialLocalCount: counts.memorialLocalCount,
    };
  });
}

function pointLatLng(geom: unknown): { lat: number; lng: number } | null {
  const g = geom as GeoJSON | undefined;
  if (!g || g.type !== "Point") return null;
  const [lng, lat] = g.coordinates;
  return { lat, lng };
}

/**
 * Loads batch metadata plus geo_features for a submission, partitioned for MapPage state
 * (`pinkNodes`, `centralSite`, `localSites`).
 */
export async function loadSubmissionBatchMapDetail(
  submissionId: string,
  projects: MapWorkspaceProjectIds
): Promise<SubmissionBatchDetail> {
  const { pinkProjectId, memorialProjectId } = projects;

  const { data: batch, error: batchErr } = await supabase
    .from("submission_batches")
    .select("submission_id, submission_name, created_by, created_at, updated_at")
    .eq("submission_id", submissionId)
    .maybeSingle();

  if (batchErr) throw batchErr;
  if (!batch) throw new Error(`Submission batch not found: ${submissionId}`);

  const b = batch as SubmissionBatchRow;

  type FeatureRow = {
    id: string;
    name: string | null;
    description: string | null;
    geom: unknown;
    project_id: string;
    feature_type: string | null;
    created_at: string | null;
  };

  const features = await fetchAllGeoFeaturePages<FeatureRow>((from, to) =>
    supabase
      .from("geo_features")
      .select("id, name, description, geom, project_id, feature_type, created_at")
      .eq("submission_id", submissionId)
      .order("id", { ascending: true })
      .range(from, to)
  );

  const pinkNodes: SubmissionBatchPinkNodeState[] = [];
  const centralCandidates: PendingSite[] = [];
  const centralMeta: { id: string; created_at: string | null }[] = [];
  const localSites: PendingSite[] = [];

  for (const row of features) {
    const ll = pointLatLng(row.geom);
    if (!ll) continue;

    const tempId = `gf-${row.id}`;

    if (pinkProjectId && row.project_id === pinkProjectId) {
      if (!isLegacyOrTaggedPinkNode(row.feature_type)) continue;
      pinkNodes.push({
        tempId,
        name: row.name,
        description: row.description,
        lat: ll.lat,
        lng: ll.lng,
      });
      continue;
    }

    if (memorialProjectId && row.project_id === memorialProjectId) {
      if (row.feature_type === "central") {
        centralCandidates.push({
          tempId,
          name: row.name,
          description: row.description,
          lat: ll.lat,
          lng: ll.lng,
          feature_type: "central",
        });
        centralMeta.push({ id: row.id, created_at: row.created_at });
      } else if (row.feature_type === "local") {
        localSites.push({
          tempId,
          name: row.name,
          description: row.description,
          lat: ll.lat,
          lng: ll.lng,
          feature_type: "local",
        });
      }
    }
  }

  /** If multiple `central` rows exist, keep the earliest by `created_at`, then `id` (lexicographic UUID order). */
  let centralSite: PendingSite | null = null;
  if (centralCandidates.length > 0) {
    const order = centralMeta.map((m, i) => ({ m, i }));
    order.sort((a, b) => {
      const ta = a.m.created_at ?? "";
      const tb = b.m.created_at ?? "";
      if (ta !== tb) return ta.localeCompare(tb);
      return a.m.id.localeCompare(b.m.id);
    });
    const win = order[0]!.i;
    centralSite = centralCandidates[win] ?? null;
    if (centralCandidates.length > 1) {
      console.warn(
        `[submissionBatches] loadSubmissionBatchMapDetail(${submissionId}): ` +
          `${centralCandidates.length} memorial central features; using created_at then id (picked ${centralMeta[win]?.id}).`
      );
    }
  }

  return {
    submissionId: b.submission_id,
    name: b.submission_name,
    createdBy: b.created_by,
    createdAt: b.created_at,
    updatedAt: b.updated_at,
    pinkNodes,
    centralSite,
    localSites,
  };
}

export async function createSubmissionBatch(params: {
  submissionId: string;
  submissionName: string;
}): Promise<void> {
  const name = params.submissionName.trim();
  if (!name) throw new Error("Submission name is required.");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated.");

  const { error } = await supabase.from("submission_batches").insert({
    submission_id: params.submissionId,
    submission_name: name,
    created_by: user.id,
  });

  if (error) throw error;
}

export async function updateSubmissionBatchNameAndTimestamp(
  submissionId: string,
  submissionName: string
): Promise<void> {
  const name = submissionName.trim();
  if (!name) throw new Error("Submission name is required.");

  const { error } = await supabase
    .from("submission_batches")
    .update({ submission_name: name })
    .eq("submission_id", submissionId);

  if (error) throw error;
}

/**
 * Deletes geo_features rows for this submission in preparation for an overwrite insert.
 *
 * **RLS:** Only rows the authenticated user is allowed to delete are removed (editor/owner on the
 * feature's project, per `geo_features` policies). Rows in projects the user cannot delete are left
 * untouched; the caller should treat leftover rows as a partial clear if that matters.
 *
 * **Map workspace (optional):** When `mapWorkspaceProjects` is passed, the delete is further
 * restricted to `project_id` in the pink and/or memorial IDs (defense in depth for the unified
 * map). When both IDs are null, this is a no-op. When omitted, any deletable row for this
 * `submission_id` is targeted (subject to RLS).
 */
export async function deleteSubmissionFeaturesForOverwrite(
  submissionId: string,
  mapWorkspaceProjects?: MapWorkspaceProjectIds
): Promise<void> {
  if (mapWorkspaceProjects) {
    const allowed = [mapWorkspaceProjects.pinkProjectId, mapWorkspaceProjects.memorialProjectId].filter(
      (id): id is string => Boolean(id)
    );
    if (allowed.length === 0) return;
    const { error } = await supabase
      .from("geo_features")
      .delete()
      .eq("submission_id", submissionId)
      .in("project_id", allowed);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("geo_features").delete().eq("submission_id", submissionId);
  if (error) throw error;
}
