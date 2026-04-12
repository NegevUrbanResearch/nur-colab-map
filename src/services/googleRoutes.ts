import supabase from "../supabase";
import { FunctionsHttpError, FunctionsRelayError } from "@supabase/supabase-js";

export type LatLng = [number, number];

interface ComputeRouteResponse {
  encodedPolyline: string;
  distanceMeters: number | null;
  durationSeconds: number | null;
}

export interface ComputedRoute {
  points: LatLng[];
  distanceMeters: number | null;
  durationSeconds: number | null;
}

function decodeSignedNumber(value: string, index: number): { number: number; nextIndex: number } {
  let result = 1;
  let shift = 0;
  let byte = 0;
  let nextIndex = index;

  do {
    byte = value.charCodeAt(nextIndex++) - 63 - 1;
    result += byte << shift;
    shift += 5;
  } while (byte >= 0x1f);

  return {
    number: (result & 1) !== 0 ? ~(result >> 1) : result >> 1,
    nextIndex,
  };
}

export function decodePolyline(encoded: string): LatLng[] {
  const coordinates: LatLng[] = [];
  let lat = 0;
  let lng = 0;
  let index = 0;

  while (index < encoded.length) {
    const latStep = decodeSignedNumber(encoded, index);
    lat += latStep.number;
    const lngStep = decodeSignedNumber(encoded, latStep.nextIndex);
    lng += lngStep.number;
    index = lngStep.nextIndex;
    coordinates.push([lat * 1e-5, lng * 1e-5]);
  }

  return coordinates;
}

/** Walking directions via the `routes-compute` function (Google Routes API, `WALK`). */
export async function computeRouteViaEdgeFunction(waypoints: LatLng[]): Promise<ComputedRoute> {
  const { data, error } = await supabase.functions.invoke<ComputeRouteResponse>(
    "routes-compute",
    {
      body: {
        waypoints: waypoints.map(([lat, lng]) => ({ lat, lng })),
      },
    }
  );

  if (error) {
    if (error instanceof FunctionsHttpError) {
      let details = "";
      try {
        const responseText = await error.context.text();
        if (responseText) details = ` ${responseText}`;
      } catch (_) {
        // no-op
      }
      throw new Error(`Routes function error: ${error.message}.${details}`.trim());
    }
    if (error instanceof FunctionsRelayError) {
      throw new Error(`Routes function relay error: ${error.message}`);
    }
    throw new Error(`Routes function error: ${error.message || "Unknown error."}`);
  }
  if (!data?.encodedPolyline) {
    throw new Error("Missing polyline in route response.");
  }

  return {
    points: decodePolyline(data.encodedPolyline),
    distanceMeters: data.distanceMeters,
    durationSeconds: data.durationSeconds,
  };
}
