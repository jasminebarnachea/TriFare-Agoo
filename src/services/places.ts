import { RoutePoint } from './routing';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type AgooPlace = {
  id: string;
  name: string;
  address: string;
  location: RoutePoint;
  rating?: number;
  reviewCount?: number;
  photoUrl?: string;
};

export async function searchAgooPlaces(query: string): Promise<AgooPlace[]> {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey || query.trim().length < 2) return [];
  const normalized = query.trim().toLowerCase();
  const cacheKey = `tri-fare-agoo:places:${normalized}`;
  const cached = await AsyncStorage.getItem(cacheKey).catch(() => null);
  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.photos',
    },
    body: JSON.stringify({
      textQuery: `${query.trim()} in Agoo, La Union, Philippines`,
      pageSize: 20,
      locationBias: {
        circle: {
          center: { latitude: 16.3221, longitude: 120.3678 },
          radius: 9000,
        },
      },
    }),
  });
  if (!response.ok) return cached ? JSON.parse(cached) : [];
  const data = await response.json();
  const results = (data.places ?? []).map((place: any) => ({
    id: place.id,
    name: place.displayName?.text ?? 'Agoo destination',
    address: place.formattedAddress ?? 'Agoo, La Union',
    location: place.location,
    rating: place.rating,
    reviewCount: place.userRatingCount,
    photoUrl: place.photos?.[0]?.name
      ? `https://places.googleapis.com/v1/${place.photos[0].name}/media?maxHeightPx=500&maxWidthPx=700&key=${apiKey}`
      : undefined,
  }));
  if (results.length) await AsyncStorage.setItem(cacheKey, JSON.stringify(results)).catch(() => {});
  return results;
}
