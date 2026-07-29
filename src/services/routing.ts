export type RoutePoint = { latitude: number; longitude: number };
export type RouteResult = {
  points: RoutePoint[];
  distanceKm: number;
  durationMinutes: number;
  alternatives?: RouteResult[];
};

export function decodeGooglePolyline(encoded: string): RoutePoint[] {
  const points: RoutePoint[] = [];
  let index = 0, latitude = 0, longitude = 0;
  while (index < encoded.length) {
    let result = 0, shift = 0, byte: number;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    latitude += (result & 1) ? ~(result >> 1) : (result >> 1);
    result = 0; shift = 0;
    do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    longitude += (result & 1) ? ~(result >> 1) : (result >> 1);
    points.push({ latitude: latitude / 1e5, longitude: longitude / 1e5 });
  }
  return points;
}

export async function computeGoogleRoute(
  origin: RoutePoint,
  destination: string | RoutePoint,
): Promise<RouteResult | null> {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;
  const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline',
    },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: origin.latitude, longitude: origin.longitude } } },
      destination: typeof destination === 'string'
        ? { address: destination }
        : { location: { latLng: destination } },
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE',
      computeAlternativeRoutes: true,
      languageCode: 'en-US',
      units: 'METRIC',
    }),
  });
  if (!response.ok) throw new Error(`Google Routes returned ${response.status}`);
  const data = await response.json();
  const parsed: RouteResult[] = (data.routes ?? []).map((route: any) => ({
    points: decodeGooglePolyline(route.polyline.encodedPolyline),
    distanceKm: route.distanceMeters / 1000,
    durationMinutes: Math.max(1, Math.round(Number(String(route.duration).replace('s', '')) / 60)),
  }));
  if (!parsed.length) return null;
  return { ...parsed[0], alternatives: parsed.slice(1) };
}
