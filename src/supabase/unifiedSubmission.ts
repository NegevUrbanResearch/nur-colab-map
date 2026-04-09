import { GeoJSON } from "geojson";
import supabase from ".";
import { MemorialFeatureType } from "./memorialSites";
import type { MapWorkspaceProjectIds } from "./submissionBatches";

export interface PendingPinkNodeSubmission {
  name: string | null;
  description: string | null;
  lat: number;
  lng: number;
}

export interface PendingMemorialSubmission {
  name: string | null;
  description: string | null;
  lat: number;
  lng: number;
  feature_type: MemorialFeatureType;
}

export type UnifiedSubmissionWriteMode = "new" | "overwrite";

type SubmitUnifiedFeaturesParamsBase = {
  pinkProjectId: string | null;
  memorialProjectId: string | null;
  includePink: boolean;
  includeMemorial: boolean;
  pinkNodes: PendingPinkNodeSubmission[];
  /** Lat/lng pairs; persisted as LineString after RPC (RPC accepts points only). */
  pinkRoutePoints?: Array<[number, number]>;
  memorialSites: PendingMemorialSubmission[];
};

/** Create a new submission batch row and insert features (default). */
export type SubmitUnifiedFeaturesParamsNew = SubmitUnifiedFeaturesParamsBase & {
  mode?: "new";
  submissionId: string;
  /** When omitted, uses the same legacy-style default as DB backfill: `הגשה ללא שם - <short id>`. */
  submissionName?: string;
};

/** Replace all features in the map workspace for an existing submission and refresh batch metadata. */
export type SubmitUnifiedFeaturesParamsOverwrite = SubmitUnifiedFeaturesParamsBase & {
  mode: "overwrite";
  targetSubmissionId: string;
  submissionName: string;
  /**
   * Limits deletes to these projects; defaults to `{ pinkProjectId, memorialProjectId }` from this call.
   */
  mapWorkspaceProjects?: MapWorkspaceProjectIds;
};

export type SubmitUnifiedFeaturesParams =
  | SubmitUnifiedFeaturesParamsNew
  | SubmitUnifiedFeaturesParamsOverwrite;

function defaultSubmissionBatchName(submissionId: string): string {
  const short = submissionId.replace(/-/g, "").slice(0, 8);
  return `הגשה ללא שם - ${short}`;
}

function buildGeoFeatureRows(
  submissionId: string,
  params: Pick<
    SubmitUnifiedFeaturesParams,
    | "pinkProjectId"
    | "memorialProjectId"
    | "includePink"
    | "includeMemorial"
    | "pinkNodes"
    | "memorialSites"
  >
): Array<{
  project_id: string;
  submission_id: string;
  name: string;
  description: string;
  geom: GeoJSON;
  feature_type?: MemorialFeatureType | "pink_line_node";
}> {
  const rows: Array<{
    project_id: string;
    submission_id: string;
    name: string;
    description: string;
    geom: GeoJSON;
    feature_type?: MemorialFeatureType | "pink_line_node";
  }> = [];

  if (params.includePink) {
    if (!params.pinkProjectId) {
      throw new Error("Pink Line project not found for this user.");
    }

    rows.push(
      ...params.pinkNodes.map((node) => ({
        project_id: params.pinkProjectId!,
        submission_id: submissionId,
        name: node.name?.trim() || "Pink Line Node",
        description: node.description?.trim() || "",
        geom: { type: "Point", coordinates: [node.lng, node.lat] } as GeoJSON,
        feature_type: "pink_line_node" as const,
      }))
    );
  }

  if (params.includeMemorial) {
    if (!params.memorialProjectId) {
      throw new Error("Memorial Sites project not found for this user.");
    }

    rows.push(
      ...params.memorialSites.map((site) => ({
        project_id: params.memorialProjectId!,
        submission_id: submissionId,
        name: site.name?.trim() || "",
        description: site.description?.trim() || "",
        geom: { type: "Point", coordinates: [site.lng, site.lat] } as GeoJSON,
        feature_type: site.feature_type,
      }))
    );
  }

  return rows;
}

function rowsToRpcPayload(
  rows: ReturnType<typeof buildGeoFeatureRows>
): Array<{
  project_id: string;
  name: string;
  description: string;
  lng: number;
  lat: number;
  feature_type: MemorialFeatureType | "pink_line_node" | null;
}> {
  return rows.map((r) => {
    const g = r.geom as GeoJSON.Point;
    const [lng, lat] = g.coordinates;
    return {
      project_id: r.project_id,
      name: r.name,
      description: r.description,
      lng,
      lat,
      feature_type: r.feature_type ?? null,
    };
  });
}

async function insertPinkRouteLineIfNeeded(
  submissionId: string,
  pinkProjectId: string | null,
  includePink: boolean,
  pinkRoutePoints: Array<[number, number]> | undefined
): Promise<void> {
  if (!includePink || !pinkProjectId) return;
  const pts = pinkRoutePoints ?? [];
  if (pts.length < 2) return;

  const routeGeoJSON: GeoJSON = {
    type: "LineString",
    coordinates: pts.map(([lat, lng]) => [lng, lat]),
  };

  const { error } = await supabase.from("geo_features").insert({
    project_id: pinkProjectId,
    submission_id: submissionId,
    name: "Pink Line Route",
    description: "Computed route using Google Routes API",
    geom: routeGeoJSON,
    feature_type: "pink_line_route",
  });
  if (error) throw error;
}

/**
 * Inserts map features for the pink and/or memorial projects under one `submission_id`, via a single
 * transactional RPC (`submit_unified_submission_write`).
 */
export async function submitUnifiedFeatures(params: SubmitUnifiedFeaturesParams): Promise<void> {
  const pinkRoutePoints = params.pinkRoutePoints;

  if (params.mode === "overwrite") {
    const { targetSubmissionId, submissionName } = params;
    const workspace: MapWorkspaceProjectIds =
      params.mapWorkspaceProjects ?? {
        pinkProjectId: params.pinkProjectId,
        memorialProjectId: params.memorialProjectId,
      };

    const rows = buildGeoFeatureRows(targetSubmissionId, params);
    const { error } = await supabase.rpc("submit_unified_submission_write", {
      p_mode: "overwrite",
      p_submission_id: targetSubmissionId,
      p_submission_name: submissionName,
      p_pink_project_id: workspace.pinkProjectId,
      p_memorial_project_id: workspace.memorialProjectId,
      p_feature_rows: rowsToRpcPayload(rows),
    });
    if (error) throw error;
    await insertPinkRouteLineIfNeeded(
      targetSubmissionId,
      params.pinkProjectId,
      params.includePink,
      pinkRoutePoints
    );
    return;
  }

  const { submissionId } = params;
  const trimmedName = params.submissionName?.trim();
  const batchName = trimmedName ? trimmedName : defaultSubmissionBatchName(submissionId);

  const rows = buildGeoFeatureRows(submissionId, params);
  const hasPersistableRoute =
    params.includePink &&
    pinkRoutePoints &&
    pinkRoutePoints.length > 1;
  if (rows.length === 0 && !hasPersistableRoute) return;

  const { error } = await supabase.rpc("submit_unified_submission_write", {
    p_mode: "new",
    p_submission_id: submissionId,
    p_submission_name: batchName,
    p_pink_project_id: params.pinkProjectId,
    p_memorial_project_id: params.memorialProjectId,
    p_feature_rows: rowsToRpcPayload(rows),
  });
  if (error) throw error;
  await insertPinkRouteLineIfNeeded(
    submissionId,
    params.pinkProjectId,
    params.includePink,
    pinkRoutePoints
  );
}
