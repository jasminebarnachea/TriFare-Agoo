export type RoutePoint = { latitude: number; longitude: number };
export type RouteResult = {
  points: RoutePoint[];
  distanceKm: number;
  durationMinutes: number;
  alternatives?: RouteResult[];
};

const ORS_URL = 'https://api.openrouteservice.org';
const TRICYCLE_CRUISING_KPH = 22;

function tricycleDurationMinutes(distanceKm: number, roadDurationSeconds: number) {
  const roadMinutes = roadDurationSeconds / 60;
  const localTricycleMinutes = distanceKm / TRICYCLE_CRUISING_KPH * 60;
  return Math.max(1, Math.ceil(Math.max(roadMinutes, localTricycleMinutes)));
}

async function geocodeDestination(destination: string, apiKey: string): Promise<RoutePoint | null> {
  const params = new URLSearchParams({
    api_key: apiKey,
    text: destination,
    size: '1',
    'boundary.circle.lat': '16.3221',
    'boundary.circle.lon': '120.3678',
    'boundary.circle.radius': '12',
  });
  const response = await fetch(`${ORS_URL}/geocode/search?${params}`);
  if (!response.ok) throw new Error(`openrouteservice geocoding returned ${response.status}`);
  const feature = (await response.json()).features?.[0];
  if (!feature?.geometry?.coordinates) return null;
  return { latitude: feature.geometry.coordinates[1], longitude: feature.geometry.coordinates[0] };
}

export async function computeRoute(origin: RoutePoint, destination: string | RoutePoint): Promise<RouteResult | null> {
  const apiKey = process.env.EXPO_PUBLIC_OPENROUTESERVICE_API_KEY;
  if (!apiKey) return null;
  const destinationPoint = typeof destination === 'string'
    ? await geocodeDestination(destination, apiKey)
    : destination;
  if (!destinationPoint) return null;

  const response = await fetch(`${ORS_URL}/v2/directions/driving-car/geojson`, {
    method: 'POST',
    headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      coordinates: [
        [origin.longitude, origin.latitude],
        [destinationPoint.longitude, destinationPoint.latitude],
      ],
      instructions: false,
      preference: 'recommended',
    }),
  });
  if (!response.ok) throw new Error(`openrouteservice directions returned ${response.status}`);
  const data = await response.json();
  const parsed: RouteResult[] = (data.features ?? []).map((feature: any) => {
    const distanceKm = Number(feature.properties?.summary?.distance ?? 0) / 1000;
    const roadDurationSeconds = Number(feature.properties?.summary?.duration ?? 0);
    return {
      points: (feature.geometry?.coordinates ?? []).map(([longitude, latitude]: number[]) => ({ latitude, longitude })),
      distanceKm,
      durationMinutes: tricycleDurationMinutes(distanceKm, roadDurationSeconds),
    };
  }).filter((route: RouteResult) => route.points.length > 1);
  if (!parsed.length) return null;
  return { ...parsed[0], alternatives: parsed.slice(1) };
}
