export type FareEntry = {
  barangay: string;
  distance: string;
  regular: number;
  special: number;
};

// Municipal Ordinance No. 14-2026, ₱20 base-fare bracket (₱101–₱110/L).
export const FARES: FareEntry[] = [
  { barangay: 'Abagatan – Centro SJSJ', distance: '2.6', regular: 20, special: 16 },
  { barangay: 'Ambitacay – Centro', distance: '6.5', regular: 25, special: 20 },
  { barangay: 'Ambitacay (boundary San Francisco)', distance: '8.3', regular: 29, special: 23 },
  { barangay: 'Bacsil (Agila)', distance: '1.2', regular: 20, special: 16 },
  { barangay: 'PEQNHS – Hill', distance: '2.12', regular: 20, special: 16 },
  { barangay: 'Balawarte / San Julian West (Interior)', distance: '2.8 / 2.9', regular: 20, special: 16 },
  { barangay: 'San Manuel Sur', distance: '6.5', regular: 25, special: 20 },
  { barangay: 'Capas (boundary Pongpong)', distance: '9', regular: 30, special: 24 },
  { barangay: 'ULPI', distance: '5.5', regular: 23, special: 18 },
  { barangay: 'Consolacion / San Antonio / San Miguel', distance: '0.8 / 2 / 1.8', regular: 20, special: 16 },
  { barangay: 'L.U Medical Hospital (Nazareno)', distance: '3.5', regular: 20, special: 16 },
  { barangay: 'Macalva Central', distance: '5.5', regular: 23, special: 18 },
  { barangay: 'Macalva Norte – Centro', distance: '6.5', regular: 24, special: 19 },
  { barangay: 'Macalva Norte (boundary Leones)', distance: '7.2', regular: 26, special: 21 },
  { barangay: 'Macalva Sur – Centro', distance: '5', regular: 22, special: 18 },
  { barangay: 'Macalva Sur – Little Baguio', distance: '5.6', regular: 23, special: 18 },
  { barangay: 'Museum', distance: '0.125', regular: 20, special: 16 },
  { barangay: 'Plaza', distance: '0.26', regular: 20, special: 16 },
  { barangay: 'Purok', distance: '3.8', regular: 20, special: 16 },
  { barangay: 'San Antonino', distance: '1.8', regular: 20, special: 16 },
  { barangay: 'San Joaquin', distance: '1.2', regular: 20, special: 16 },
  { barangay: 'San Nicolas Central and Norte', distance: '0.4 / 0.2', regular: 20, special: 16 },
  { barangay: 'San Francisco', distance: '5.2', regular: 22, special: 18 },
  { barangay: 'San Isidro (Main)', distance: '4.5', regular: 21, special: 17 },
  { barangay: 'San Isidro (Interior)', distance: '5.5', regular: 23, special: 18 },
  { barangay: 'San Joaquin Sur / San Joaquin Norte', distance: '2.9 / 1.2', regular: 20, special: 16 },
  { barangay: 'San Julian Central / Cabagoan', distance: '2 / 2.3', regular: 20, special: 16 },
  { barangay: 'San Juan / San Nicolas West', distance: '2 / 4', regular: 20, special: 16 },
  { barangay: 'San Julian East / Sta. Barbara', distance: '2 / 0.9', regular: 20, special: 16 },
  { barangay: 'San Manuel Norte', distance: '6', regular: 24, special: 19 },
  { barangay: 'San Marcos / Sta. Monica / Sta. Barbara', distance: '0.9 / 2.5 / 1', regular: 20, special: 16 },
  { barangay: 'San Roque East (to Sitio IPES)', distance: '5.5', regular: 23, special: 18 },
  { barangay: 'San Roque East (to Sitio TOCOK)', distance: '6.5', regular: 24, special: 19 },
  { barangay: 'San Roque West (CENTRO)', distance: '6', regular: 24, special: 19 },
  { barangay: 'San Roque West (to Sitio CRUZ)', distance: '6.5', regular: 25, special: 20 },
  { barangay: 'San Vicente – San Agustin', distance: '2.13 / 2.8', regular: 20, special: 16 },
  { barangay: 'Sta. Maria (Sococ)', distance: '3.6', regular: 20, special: 16 },
  { barangay: 'Sta. Rita Central', distance: '5.5', regular: 23, special: 18 },
  { barangay: 'Sta. Rita Sur (via San Vicente)', distance: '4.5', regular: 21, special: 17 },
  { barangay: 'Sta. Rita Sur (via Sta. Rita West)', distance: '5.8', regular: 24, special: 19 },
  { barangay: 'Sta. Rita Norte', distance: '4.6', regular: 21, special: 17 },
  { barangay: 'Sta. Rita West', distance: '5.1', regular: 22, special: 18 },
  { barangay: 'Up to Washington Hi-way', distance: '3.9', regular: 20, special: 16 },
  { barangay: 'Washington Interior', distance: '4.5', regular: 21, special: 17 }
];

export const TERMINALS = [
  { name: 'Agoo Public Market Terminal', distance: '320 m away', latitude: 16.3214, longitude: 120.3674, open: 'Open 24h' },
  { name: 'San Julian Tricycle Terminal', distance: '640 m away', latitude: 16.3241, longitude: 120.3695, open: 'Open until 9 PM' },
  { name: 'Agoo Plaza Terminal', distance: '1.2 km away', latitude: 16.3189, longitude: 120.3652, open: 'Open 24h' }
];

export type TouristSpot = {
  name: string;
  category: string;
  description: string;
  distance: string;
  latitude: number;
  longitude: number;
  query: string;
};

export const TOURIST_SPOTS: TouristSpot[] = [
  {
    name: 'Basilica Minore',
    category: 'Heritage · Pilgrimage',
    description: 'Agoo’s historic Basilica of Our Lady of Charity, founded in 1578.',
    distance: '0.1 km from Municipal Hall',
    latitude: 16.3223, longitude: 120.3671,
    query: 'Basilica Minore of Our Lady of Charity, Agoo, La Union',
  },
  {
    name: 'Museo de Iloko',
    category: 'Museum · Culture',
    description: 'An American colonial-era museum preserving Ilokano artifacts and local history.',
    distance: '0.1 km from Municipal Hall',
    latitude: 16.3217, longitude: 120.3675,
    query: 'Museo de Iloko, Agoo, La Union',
  },
  {
    name: 'Eagle of the North',
    category: 'Landmark · Park',
    description: 'A landmark park at the gateway to the Jose D. Aspiras Highway.',
    distance: '0.9 km from Municipal Hall',
    latitude: 16.3299547, longitude: 120.3680353,
    query: 'Eagle of The North Park, Agoo, La Union',
  },
  {
    name: 'Lourdes Grotto',
    category: 'Pilgrimage · Garden',
    description: 'A peaceful Marian pilgrimage site in Barangay San Antonio.',
    distance: '1.1 km from Municipal Hall',
    latitude: 16.3316, longitude: 120.3727,
    query: 'Our Lady of Lourdes Grotto, Agoo, La Union',
  },
  {
    name: 'Agoo Eco-Fun World',
    category: 'Nature · Eco-tourism',
    description: 'Lakeside nature trails, picnic areas, boating, and coastal scenery.',
    distance: '5.7 km from Municipal Hall',
    latitude: 16.3274, longitude: 120.3336,
    query: 'Agoo Eco-Fun World, Agoo, La Union',
  },
  {
    name: 'Agoo–Damortis Coast',
    category: 'Coast · Protected landscape',
    description: 'Mangroves, seagrass beds, and black-sand coastline along Lingayen Gulf.',
    distance: '5.2 km from Municipal Hall',
    latitude: 16.3184, longitude: 120.3268,
    query: 'Agoo Damortis Protected Landscape and Seascape, La Union',
  },
];
