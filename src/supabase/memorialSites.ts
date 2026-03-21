import supabase from ".";
import { GeoJSON } from "geojson";

export type MemorialFeatureType = "central" | "local";

export interface MemorialSite {
  id: string;
  name: string | null;
  description: string | null;
  lat: number;
  lng: number;
  feature_type: MemorialFeatureType;
}

export async function loadCentralMemorial(projectId: string): Promise<MemorialSite | null> {
  const { data, error } = await supabase
    .from("geo_features")
    .select("id, name, description, geom, feature_type")
    .eq("project_id", projectId)
    .eq("feature_type", "central")
    .maybeSingle();

  if (error) throw error;
  if (!data?.geom || (data.geom as GeoJSON).type !== "Point") return null;

  const [lng, lat] = (data.geom as GeoJSON.Point).coordinates;
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    lat,
    lng,
    feature_type: "central",
  };
}

export async function loadLocalMemorials(projectId: string): Promise<MemorialSite[]> {
  const { data, error } = await supabase
    .from("geo_features")
    .select("id, name, description, geom, feature_type")
    .eq("project_id", projectId)
    .eq("feature_type", "local");

  if (error) throw error;

  return (data || []).map((row: any) => {
    const geom = row.geom as GeoJSON.Point;
    const [lng, lat] = geom?.coordinates ?? [0, 0];
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      lat,
      lng,
      feature_type: "local" as const,
    };
  });
}

export interface PendingSite {
  tempId: string;
  name: string | null;
  description: string | null;
  lat: number;
  lng: number;
  feature_type: MemorialFeatureType;
}

export async function batchCreateMemorialSites(
  projectId: string,
  sites: PendingSite[]
): Promise<void> {
  if (sites.length === 0) return;

  const submissionId = crypto.randomUUID();

  const rows = sites.map((s) => ({
    project_id: projectId,
    name: s.name ?? "",
    description: s.description ?? "",
    geom: { type: "Point", coordinates: [s.lng, s.lat] } as GeoJSON,
    feature_type: s.feature_type,
    submission_id: submissionId,
  }));

  const { error } = await supabase.from("geo_features").insert(rows);
  if (error) throw error;
}
