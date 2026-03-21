import supabase from ".";
import { GeoJSON } from "geojson";

export interface PinkLineNode {
  id: string;
  lat: number;
  lng: number;
  submissionId: string | null;
}

export async function createPinkLineNode(
  projectId: string,
  lat: number,
  lng: number,
  name: string | null = null,
  description: string | null = null
): Promise<PinkLineNode | null> {
  const pointGeoJSON: GeoJSON = {
    type: "Point",
    coordinates: [lng, lat],
  };

  const { data, error } = await supabase
    .from("geo_features")
    .insert([
      {
        name: name ?? "Pink Line Node",
        description,
        geom: pointGeoJSON,
        project_id: projectId,
        submission_id: null,
      },
    ])
    .select("id")
    .single();

  if (error) {
    console.error("Failed to create node:", error);
    return null;
  }

  return {
    id: data.id,
    lat,
    lng,
    submissionId: null,
  };
}

export async function loadPinkLineNodes(projectId: string): Promise<PinkLineNode[]> {
  const { data, error } = await supabase
    .from("geo_features")
    .select("id, geom, submission_id")
    .eq("project_id", projectId)
    .is("submission_id", null);

  if (error) throw error;

  return (data || []).map((feature: any) => {
    const geom = feature.geom as GeoJSON;
    if (geom.type === "Point") {
      const [lng, lat] = (geom as any).coordinates;
      return {
        id: feature.id,
        lat,
        lng,
        submissionId: feature.submission_id,
      };
    }
    return null;
  }).filter((node): node is PinkLineNode => node !== null);
}

export async function submitPinkLineRoute(projectId: string, nodeIds: string[]): Promise<void> {
  if (nodeIds.length === 0) return;

  const submissionId = crypto.randomUUID();

  const { error } = await supabase
    .from("geo_features")
    .update({ submission_id: submissionId })
    .in("id", nodeIds)
    .eq("project_id", projectId);

  if (error) throw error;
}

export async function deletePinkLineNode(nodeId: string): Promise<void> {
  const { error } = await supabase
    .from("geo_features")
    .delete()
    .eq("id", nodeId);

  if (error) throw error;
}
