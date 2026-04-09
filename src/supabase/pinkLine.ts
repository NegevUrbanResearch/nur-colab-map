import supabase from ".";
import { GeoJSON } from "geojson";

export interface PinkLineNode {
  id: string;
  lat: number;
  lng: number;
  submissionId: string | null;
}

export interface PinkLineRoute {
  submissionId: string;
  points: Array<[number, number]>;
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

export async function submitPinkLineRoute(
  projectId: string,
  nodeIds: string[],
  routePoints: Array<[number, number]> = []
): Promise<string> {
  if (nodeIds.length === 0) {
    throw new Error("Cannot submit route without nodes.");
  }

  const submissionId = crypto.randomUUID();

  if (routePoints.length > 1) {
    const routeGeoJSON: GeoJSON = {
      type: "LineString",
      coordinates: routePoints.map(([lat, lng]) => [lng, lat]),
    };

    const { error: routeError } = await supabase.from("geo_features").insert([
      {
        name: "Pink Line Route",
        description: "Computed route using Google Routes API",
        geom: routeGeoJSON,
        project_id: projectId,
        submission_id: submissionId,
        feature_type: "pink_line_route",
      },
    ]);

    if (routeError) throw routeError;
  }

  const { error } = await supabase
    .from("geo_features")
    .update({ submission_id: submissionId })
    .in("id", nodeIds)
    .eq("project_id", projectId);

  if (error) throw error;

  return submissionId;
}

export async function loadLatestSubmittedPinkLineRoute(
  projectId: string
): Promise<PinkLineRoute | null> {
  const { data, error } = await supabase
    .from("geo_features")
    .select("submission_id, geom")
    .eq("project_id", projectId)
    .eq("feature_type", "pink_line_route")
    .not("submission_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data || !data.submission_id) return null;

  const geom = data.geom as GeoJSON;
  if (!geom || geom.type !== "LineString") return null;

  const coords = (geom as any).coordinates as [number, number][];
  const points: Array<[number, number]> = coords.map(([lng, lat]) => [lat, lng]);

  if (points.length < 2) return null;

  return {
    submissionId: data.submission_id,
    points,
  };
}

export async function deletePinkLineNode(nodeId: string): Promise<void> {
  const { error } = await supabase
    .from("geo_features")
    .delete()
    .eq("id", nodeId);

  if (error) throw error;
}
