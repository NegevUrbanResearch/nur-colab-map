import supabase from ".";
import { GeoJSON } from "geojson";

export interface Feature {
  id: number;
  name: string;
  geom: GeoJSON;
  project_id: string;
}

// Helper: get project ID from URL query
function getProjectId(): string {
  const params = new URLSearchParams(window.location.search);
  const projectId = params.get("projectId");
  if (!projectId) {
    throw new Error("Missing project ID in URL (?projectId=...)");
  }
  return projectId;
}

export async function loadGeometries(): Promise<Feature[]> {
  const projectId = getProjectId();

  const { data, error } = await supabase
    .from("geo_features")
    .select("id, name, geom, project_id")
    .eq("project_id", projectId); // Only load for this project

  if (error) throw error;
  return data as Feature[];
}

export async function createGeometry(name: string, geom: GeoJSON) {
  const projectId = getProjectId();

  const { data, error } = await supabase
    .from("geo_features")
    .insert([{ name, geom, project_id: projectId }])
    .select();

  if (error) throw error;
  return data[0];
}

export async function updateGeometry(id: number, geom: GeoJSON) {
  const { data, error } = await supabase
    .from("geo_features")
    .update({ geom })
    .eq("id", id)
    .select();

  if (error) throw error;
  return data[0];
}

export async function deleteGeometry(id: number) {
  console.log("Deleting geometry with ID:", id);
  const { error } = await supabase.from("geo_features").delete().eq("id", id);
  if (error) throw error;
}
