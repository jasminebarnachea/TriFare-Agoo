import { RoutePoint } from './routing';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type AgooPlace = {
  id: string;
  name: string;
  address: string;
  location: RoutePoint;
  rating?: number;
  reviewCount?: number;
};

export async function searchAgooPlaces(query: string): Promise<AgooPlace[]> {
  const apiKey = process.env.EXPO_PUBLIC_OPENROUTESERVICE_API_KEY;
  if (!apiKey || query.trim().length < 2) return [];
  const normalized = query.trim().toLowerCase();
  const cacheKey = `tri-fare-agoo:ors-places:${normalized}`;
  const cached = await AsyncStorage.getItem(cacheKey).catch(() => null);
  const params = new URLSearchParams({
    api_key: apiKey,
    text: `${query.trim()}, Agoo, La Union, Philippines`,
    size: '20',
    'boundary.circle.lat': '16.3221',
    'boundary.circle.lon': '120.3678',
    'boundary.circle.radius': '12',
  });
  const response = await fetch(`https://api.openrouteservice.org/geocode/search?${params}`);
  if (!response.ok) return cached ? JSON.parse(cached) : [];
  const data = await response.json();
  const results: AgooPlace[] = (data.features ?? []).map((feature: any, index: number) => ({
    id: feature.properties?.id ?? feature.properties?.gid ?? `${normalized}-${index}`,
    name: feature.properties?.name ?? feature.properties?.label?.split(',')[0] ?? 'Agoo destination',
    address: feature.properties?.label ?? 'Agoo, La Union',
    location: {
      latitude: feature.geometry.coordinates[1],
      longitude: feature.geometry.coordinates[0],
    },
  })).filter((place: AgooPlace) => Number.isFinite(place.location.latitude) && Number.isFinite(place.location.longitude));
  if (results.length) await AsyncStorage.setItem(cacheKey, JSON.stringify(results)).catch(() => {});
  return results;
}
