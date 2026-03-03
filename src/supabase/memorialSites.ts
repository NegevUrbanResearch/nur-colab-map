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

function getProjectId(): string {
  const params = new URLSearchParams(window.location.search);
  const projectId = params.get("projectId");
  if (!projectId) throw new Error("Missing projectId in URL");
  return projectId;
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

export async function createMemorialSite(
  projectId: string,
  lat: number,
  lng: number,
  name: string | null,
  description: string | null,
  featureType: MemorialFeatureType
): Promise<MemorialSite> {
  if (featureType === "central") {
    const existing = await loadCentralMemorial(projectId);
    if (existing) await deleteMemorialSite(existing.id);
  }

  const geom: GeoJSON = { type: "Point", coordinates: [lng, lat] };
  const { data, error } = await supabase
    .from("geo_features")
    .insert({
      project_id: projectId,
      name: name ?? "",
      description: description ?? "",
      geom,
      feature_type: featureType,
    })
    .select("id, name, description, geom, feature_type")
    .single();

  if (error) throw error;
  const [x, y] = (data.geom as GeoJSON.Point).coordinates;
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    lat: y,
    lng: x,
    feature_type: data.feature_type,
  };
}

export async function deleteMemorialSite(id: string): Promise<void> {
  const { error } = await supabase.from("geo_features").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteAllMemorialSites(projectId: string): Promise<void> {
  const { error } = await supabase
    .from("geo_features")
    .delete()
    .eq("project_id", projectId)
    .in("feature_type", ["central", "local"]);
  if (error) throw error;
}
