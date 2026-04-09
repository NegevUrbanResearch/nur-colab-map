import { createClient } from "jsr:@supabase/supabase-js@2";

type LatLng = { lat: number; lng: number };

interface ComputeRouteRequest {
  waypoints: LatLng[];
}

const GOOGLE_ROUTES_ENDPOINT = "https://routes.googleapis.com/directions/v2:computeRoutes";
const GOOGLE_ROUTES_FIELD_MASK = [
  "routes.polyline.encodedPolyline",
  "routes.distanceMeters",
  "routes.duration",
].join(",");

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidLatLng(point: unknown): point is LatLng {
  if (!point || typeof point !== "object") return false;
  const lat = (point as { lat?: unknown }).lat;
  const lng = (point as { lng?: unknown }).lng;
  return (
    isFiniteNumber(lat) &&
    isFiniteNumber(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function durationToSeconds(duration: string | undefined): number | null {
  if (!duration) return null;
  const match = duration.match(/^([0-9]+(?:\.[0-9]+)?)s$/);
  if (!match) return null;
  return Number(match[1]);
}

function toWaypoint(point: LatLng) {
  return {
    location: {
      latLng: {
        latitude: point.lat,
        longitude: point.lng,
      },
    },
  };
}

function errorResponse(message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function verifyAuth(req: Request): Promise<Response | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return errorResponse("Missing authorization header.", 401);
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } }
  );

  const {
    data: { user },
    error,
  } = await supabaseClient.auth.getUser();

  if (error || !user) {
    return errorResponse("Invalid or expired auth token.", 401);
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return errorResponse("Method not allowed.", 405);
  }

  const authError = await verifyAuth(req);
  if (authError) return authError;

  const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
  if (!apiKey) {
    return errorResponse("Missing GOOGLE_MAPS_API_KEY secret.", 500);
  }

  let payload: ComputeRouteRequest;
  try {
    payload = (await req.json()) as ComputeRouteRequest;
  } catch (_) {
    return errorResponse("Invalid JSON body.");
  }

  const { waypoints } = payload;
  if (!Array.isArray(waypoints) || waypoints.length < 2) {
    return errorResponse("At least two waypoints are required.");
  }
  if (waypoints.length > 25) {
    return errorResponse("A maximum of 25 waypoints is supported.");
  }
  if (!waypoints.every(isValidLatLng)) {
    return errorResponse("One or more waypoints are invalid.");
  }

  const origin = waypoints[0];
  const destination = waypoints[waypoints.length - 1];
  const intermediates = waypoints.slice(1, -1).map(toWaypoint);
  const requestBody = {
    origin: toWaypoint(origin),
    destination: toWaypoint(destination),
    intermediates,
    travelMode: "DRIVE",
    routingPreference: "TRAFFIC_UNAWARE",
    computeAlternativeRoutes: false,
    optimizeWaypointOrder: false,
    polylineQuality: "OVERVIEW",
    polylineEncoding: "ENCODED_POLYLINE",
    routeModifiers: {
      avoidTolls: false,
      avoidHighways: false,
      avoidFerries: false,
    },
    units: "METRIC",
    languageCode: "en-US",
  };

  const googleRes = await fetch(GOOGLE_ROUTES_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": GOOGLE_ROUTES_FIELD_MASK,
    },
    body: JSON.stringify(requestBody),
  });

  const googleJson = await googleRes.json();

  if (!googleRes.ok) {
    return errorResponse(
      `Google Routes request failed: ${googleJson?.error?.message || googleRes.statusText}`,
      googleRes.status
    );
  }

  const route = Array.isArray(googleJson?.routes) ? googleJson.routes[0] : null;
  const encodedPolyline = route?.polyline?.encodedPolyline;
  if (typeof encodedPolyline !== "string" || encodedPolyline.length === 0) {
    return errorResponse("Google Routes did not return a polyline.", 502);
  }

  return new Response(
    JSON.stringify({
      encodedPolyline,
      distanceMeters: typeof route?.distanceMeters === "number" ? route.distanceMeters : null,
      durationSeconds: durationToSeconds(route?.duration),
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
