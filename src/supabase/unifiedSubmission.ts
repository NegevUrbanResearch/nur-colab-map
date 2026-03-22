import { GeoJSON } from "geojson";
import supabase from ".";
import { MemorialFeatureType } from "./memorialSites";

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

interface SubmitUnifiedFeaturesParams {
  submissionId: string;
  pinkProjectId: string | null;
  memorialProjectId: string | null;
  includePink: boolean;
  includeMemorial: boolean;
  pinkNodes: PendingPinkNodeSubmission[];
  memorialSites: PendingMemorialSubmission[];
}

export async function submitUnifiedFeatures({
  submissionId,
  pinkProjectId,
  memorialProjectId,
  includePink,
  includeMemorial,
  pinkNodes,
  memorialSites,
}: SubmitUnifiedFeaturesParams): Promise<void> {
  const rows: Array<{
    project_id: string;
    submission_id: string;
    name: string;
    description: string;
    geom: GeoJSON;
    feature_type?: MemorialFeatureType;
  }> = [];

  if (includePink) {
    if (!pinkProjectId) {
      throw new Error("Pink Line project not found for this user.");
    }

    rows.push(
      ...pinkNodes.map((node) => ({
        project_id: pinkProjectId,
        submission_id: submissionId,
        name: node.name?.trim() || "Pink Line Node",
        description: node.description?.trim() || "",
        geom: { type: "Point", coordinates: [node.lng, node.lat] } as GeoJSON,
      }))
    );
  }

  if (includeMemorial) {
    if (!memorialProjectId) {
      throw new Error("Memorial Sites project not found for this user.");
    }

    rows.push(
      ...memorialSites.map((site) => ({
        project_id: memorialProjectId,
        submission_id: submissionId,
        name: site.name?.trim() || "",
        description: site.description?.trim() || "",
        geom: { type: "Point", coordinates: [site.lng, site.lat] } as GeoJSON,
        feature_type: site.feature_type,
      }))
    );
  }

  if (rows.length === 0) return;

  const { error } = await supabase.from("geo_features").insert(rows);
  if (error) throw error;
}
