import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import MapView, { AnimatedRegion, Circle as MapCircle, Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { UserFullViewIcon } from '@hugeicons/core-free-icons';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft, ArrowRight, Calculator, Camera, Check, ChevronRight, Clock3,
  Eye, EyeOff, Flag, History, Home, Layers3, LocateFixed, MapPin, MapPinned,
  MessageSquareWarning, Moon, Navigation, Repeat2, Search, Send, ShieldCheck, SlidersHorizontal,
  Sun, Upload, X,
} from 'lucide-react-native';
import {
  Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold,
  Manrope_700Bold, Manrope_800ExtraBold, useFonts,
} from '@expo-google-fonts/manrope';
import { FARES, FareEntry, TERMINALS, TOURIST_SPOTS, TouristSpot } from './src/data/fares';
import { computeRoute, RoutePoint, RouteResult } from './src/services/routing';
import { AgooPlace, searchAgooPlaces } from './src/services/places';

const C = {
  green: '#07834F', deep: '#075E3C', mint: '#E8F4EE', pale: '#F4F7F4',
  ink: '#17211C', muted: '#718078', line: '#DDE6E0', white: '#FFFFFF',
  red: '#E53F48', blue: '#1E69E8', amber: '#F4AE23',
};
const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#17201B' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9EAAA2' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#17201B' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#425047' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#19231D' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#203027' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#173727' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#344139' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#111814' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#46564C' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#28342D' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0B2933' }] },
] as any[];
type Tab = 'home' | 'fare' | 'history' | 'profile';
type Screen = Tab | 'terminals' | 'matrix' | 'report' | 'route' | 'ride';
const AGOO: Region = { latitude: 16.3221, longitude: 120.3678, latitudeDelta: 0.025, longitudeDelta: 0.018 };
const routeLine = [
  { latitude: 16.3211, longitude: 120.3667 }, { latitude: 16.322, longitude: 120.3672 },
  { latitude: 16.323, longitude: 120.3681 }, { latitude: 16.3243, longitude: 120.3695 },
];
const TOURIST_FARE_DESTINATIONS: FareEntry[] = [
  { barangay: 'Basilica Minore of Our Lady of Charity', distance: '0.3', regular: 20, special: 16 },
  { barangay: 'Museo de Iloko', distance: '0.2', regular: 20, special: 16 },
  { barangay: 'Eagle of the North Park', distance: '0.9', regular: 20, special: 16 },
  { barangay: 'Our Lady of Lourdes Grotto', distance: '1.1', regular: 20, special: 16 },
  { barangay: 'Agoo Eco Park (Sta. Rita)', distance: '5.5', regular: 23, special: 18 },
  { barangay: 'Agoo Plaza', distance: '0.3', regular: 20, special: 16 },
  { barangay: 'Agoo Municipal Hall', distance: '0.2', regular: 20, special: 16 },
];
const SEARCHABLE_DESTINATIONS = [...TOURIST_FARE_DESTINATIONS, ...FARES];
const AGOO_MARKET_FARE: FareEntry = { barangay: 'Agoo Public Market Terminal', distance: '0.5', regular: 20, special: 16 };
const VERIFIED_PLACE_PHOTOS: Record<string, number> = {
  'Basilica Minore': require('./assets/places/basilica.jpg'),
  'Museo de Iloko': require('./assets/places/museo.jpg'),
  'Eagle of the North': require('./assets/places/eagle.jpg'),
  'Agoo Eco Park': require('./assets/places/eco.jpg'),
};
const EXPLORE_PLACES = TOURIST_SPOTS.filter(spot => VERIFIED_PLACE_PHOTOS[spot.name]);
const HOME_MAP_SPOTS = TOURIST_SPOTS.filter(spot => spot.name !== 'Agoo Eco Park');
function exactTouristPoint(destinationName: string): RoutePoint | null {
  const normalized = destinationName.toLowerCase();
  const spot = TOURIST_SPOTS.find(item => {
    const name = item.name.toLowerCase();
    return normalized.includes(name)
      || (name.includes('basilica') && normalized.includes('basilica'))
      || (name.includes('eagle') && normalized.includes('eagle'))
      || (name.includes('lourdes') && normalized.includes('lourdes'))
      || (name.includes('eco park') && (normalized.includes('eco park') || normalized.includes('eco-fun')));
  });
  return spot ? { latitude: spot.latitude, longitude: spot.longitude } : null;
}
type UserProfile = {
  name: string;
  email: string;
  role: 'Agoo resident' | 'Tourist';
  photoUri: string;
  password: string;
};
type TripPlan = {
  destination: string;
  origin: RoutePoint;
  destinationPoint: RoutePoint;
  route: RoutePoint[];
  routeDistanceKm: number;
  etaMinutes: number;
  fare: number;
  special: boolean;
};
type SavedTrip = {
  id: string;
  destination: string;
  completedAt: string;
  distanceKm: number;
  fare: number;
  feedbackStatus?: 'pending' | 'no_problem' | 'reported';
};
const HISTORY_KEY = 'tri-fare-agoo:trip-history';
const ACTIVE_TRIP_KEY = 'tri-fare-agoo:active-trip';
const PROFILE_KEY = 'tri-fare-agoo:user-profile';
const SESSION_KEY = 'tri-fare-agoo:signed-in';
const THEME_KEY = 'tri-fare-agoo:theme';
const PENDING_USERS_KEY = 'tri-fare-agoo:pending-admin-users';
const PENDING_REPORTS_KEY = 'tri-fare-agoo:pending-admin-reports';
const ADMIN_API_URL = (process.env.EXPO_PUBLIC_ADMIN_API_URL || 'http://localhost:3000').replace(/\/$/, '');
type ThemeMode = 'light' | 'dark';
let darkModeActive = false;
type PendingAdminRecord = { clientId: string; fields: Record<string, string>; photoUri?: string | null };

async function sendAdminRecord(endpoint: '/api/users' | '/api/reports', record: PendingAdminRecord) {
  const form = new FormData();
  form.append('clientId', record.clientId);
  Object.entries(record.fields).forEach(([key, value]) => form.append(key, value));
  if (record.photoUri) {
    const extension = record.photoUri.split('.').pop()?.toLowerCase() || 'jpg';
    form.append('photo', { uri: record.photoUri, name: `${endpoint.includes('users') ? 'profile' : 'report'}-${record.clientId}.${extension}`, type: extension === 'png' ? 'image/png' : 'image/jpeg' } as any);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(`${ADMIN_API_URL}${endpoint}`, { method: 'POST', body: form, signal: controller.signal });
    if (!response.ok) throw new Error(`Admin server returned ${response.status}`);
  } finally { clearTimeout(timeout); }
}

async function queueAdminRecord(storageKey: string, record: PendingAdminRecord) {
  const saved = await AsyncStorage.getItem(storageKey);
  const queue = saved ? JSON.parse(saved) as PendingAdminRecord[] : [];
  if (!queue.some(item => item.clientId === record.clientId)) queue.push(record);
  await AsyncStorage.setItem(storageKey, JSON.stringify(queue));
}

async function syncAdminQueue(storageKey: string, endpoint: '/api/users' | '/api/reports') {
  const saved = await AsyncStorage.getItem(storageKey);
  if (!saved) return;
  const queue = JSON.parse(saved) as PendingAdminRecord[];
  const remaining: PendingAdminRecord[] = [];
  for (const record of queue) {
    try { await sendAdminRecord(endpoint, record); }
    catch { remaining.push(record); }
  }
  if (remaining.length) await AsyncStorage.setItem(storageKey, JSON.stringify(remaining));
  else await AsyncStorage.removeItem(storageKey);
}

function syncPendingAdminData() {
  return Promise.all([syncAdminQueue(PENDING_USERS_KEY, '/api/users'), syncAdminQueue(PENDING_REPORTS_KEY, '/api/reports')]);
}

function peso(v: number) { return `₱${v.toFixed(v % 1 ? 2 : 0)}`; }
function distanceMetres(a: RoutePoint, b: RoutePoint) {
  const rad = (value: number) => value * Math.PI / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
function routeRemainingMetres(route: RoutePoint[], current: RoutePoint) {
  if (route.length < 2) return 0;
  let nearest = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  route.forEach((point, index) => {
    const distance = distanceMetres(current, point);
    if (distance < nearestDistance) { nearestDistance = distance; nearest = index; }
  });
  let remaining = nearestDistance;
  for (let index = nearest; index < route.length - 1; index++) remaining += distanceMetres(route[index], route[index + 1]);
  return remaining;
}
function nearestRouteIndex(route: RoutePoint[], current: RoutePoint) {
  let nearest = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  route.forEach((point, index) => {
    const distance = distanceMetres(current, point);
    if (distance < nearestDistance) { nearestDistance = distance; nearest = index; }
  });
  return nearest;
}
function routeHeading(from?: RoutePoint, to?: RoutePoint) {
  if (!from || !to) return 0;
  const radians = (value: number) => value * Math.PI / 180;
  const degrees = (value: number) => value * 180 / Math.PI;
  const deltaLongitude = radians(to.longitude - from.longitude);
  const fromLatitude = radians(from.latitude);
  const toLatitude = radians(to.latitude);
  const y = Math.sin(deltaLongitude) * Math.cos(toLatitude);
  const x = Math.cos(fromLatitude) * Math.sin(toLatitude)
    - Math.sin(fromLatitude) * Math.cos(toLatitude) * Math.cos(deltaLongitude);
  return (degrees(Math.atan2(y, x)) + 360) % 360;
}
function tiltMapCamera(map: MapView | null, pitch = 50, delay = 700) {
  return setTimeout(async () => {
    if (!map) return;
    try {
      const camera = await map.getCamera();
      map.animateCamera({ ...camera, pitch }, { duration: 550 });
    } catch {}
  }, delay);
}
const AGOO_MESSENGER = 'https://m.me/MunicipalityofAgooLaUnion';
const DEVELOPER_PORTFOLIO = 'https://jasminebarnachea.vercel.app';
function reportToAgoo(issue: string, ride: string, details = '') {
  const message = `Tri Fare Agoo report\nIssue: ${issue}\nRide: ${ride}${details ? `\nDetails: ${details}` : ''}`;
  Linking.openURL(`${AGOO_MESSENGER}?text=${encodeURIComponent(message)}`)
    .catch(() => Alert.alert('Messenger unavailable', 'Open Municipality of Agoo, La Union on Facebook Messenger.'));
}

function showAgooEmergencyHotlines() {
  Alert.alert(
    'Agoo emergency hotlines',
    'PNP Agoo: 0939 836 8473\nMDRRMO Agoo: 0929 558 7444\nNational emergency: 911',
    [
      { text: 'Call PNP', onPress: () => Linking.openURL('tel:09398368473') },
      { text: 'Call MDRRMO', onPress: () => Linking.openURL('tel:09295587444') },
      { text: 'Close', style: 'cancel' },
    ],
  );
}

function TricycleIcon({ size = 24 }: { size?: number; color?: string }) {
  return <Image source={require('./assets/icons/filipino-tricycle.png')} style={{ width: size, height: size * .8, resizeMode: 'contain' }} />;
}

function PulsingDestinationMarker() {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    syncPendingAdminData().catch(() => {});
    const animation = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true }));
    animation.start();
    return () => animation.stop();
  }, []);
  return <View style={s.pulseWrap}>
    <Animated.View style={[s.pinPulse, {
      opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [.65, 0] }),
      transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [.6, 1.8] }) }],
    }]} />
    <View style={s.wazePin}><MapPin color="white" size={22} fill="white" /></View>
  </View>;
}

function NavigationArrow({ heading: _heading }: { heading: number }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1500, useNativeDriver: true }));
    animation.start();
    return () => animation.stop();
  }, []);
  return <View style={s.navigationArrowWrap}>
    <Animated.View style={[s.navigationArrowPulse, {
      opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [.3, 0] }),
      transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [.7, 1.55] }) }],
    }]} />
    <View style={s.navigationArrow}>
      <HugeiconsIcon icon={UserFullViewIcon} size={28} color="white" strokeWidth={2.4} />
    </View>
  </View>;
}

function CurrentLocationMarker() {
  return <View style={s.currentLocationMarker}>
    <HugeiconsIcon icon={UserFullViewIcon} size={25} color={C.white} strokeWidth={2.4} />
  </View>;
}

export default function App() {
  const [fonts] = useFonts({ Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold });
  if (!fonts) return <View style={{ flex: 1, backgroundColor: C.pale }} />;
  return <SafeAreaProvider><TriFareApp /></SafeAreaProvider>;
}

function TriFareApp() {
  const [profile, setProfile] = useState<UserProfile | null | undefined>(undefined);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [screen, setScreen] = useState<Screen>('home');
  const [previous, setPrevious] = useState<Screen>('home');
  const [activeTrip, setActiveTrip] = useState<TripPlan | null>(null);
  const [history, setHistory] = useState<SavedTrip[]>([]);
  const [routeSeed, setRouteSeed] = useState<FareEntry | null>(null);
  const [justArrived, setJustArrived] = useState(false);
  const [arrivedTrip, setArrivedTrip] = useState<SavedTrip | null>(null);
  const [theme, setThemeState] = useState<ThemeMode>('light');
  const [satelliteMap, setSatelliteMap] = useState(true);
  const [tiltedMap, setTiltedMap] = useState(true);
  // Screenshot privacy is finished; every map now uses the device's real GPS position.
  const privacyMode = false;
  darkModeActive = theme === 'dark';
  const setTheme = (next: ThemeMode) => {
    setThemeState(next);
    AsyncStorage.setItem(THEME_KEY, next).catch(() => {});
  };
  useEffect(() => {
    Promise.all([AsyncStorage.getItem(PROFILE_KEY), AsyncStorage.getItem(SESSION_KEY)])
      .then(([value, session]) => {
        setProfile(value && session === 'true' ? JSON.parse(value) : null);
      })
      .catch(() => setProfile(null));
    AsyncStorage.getItem(HISTORY_KEY).then(value => value && setHistory(JSON.parse(value))).catch(() => {});
    AsyncStorage.getItem(ACTIVE_TRIP_KEY).then(value => {
      if (!value) return;
      const trip = JSON.parse(value) as TripPlan;
      setActiveTrip(trip); setScreen('ride');
    }).catch(() => {});
    AsyncStorage.getItem(THEME_KEY).then(value => {
      if (value === 'dark' || value === 'light') setThemeState(value);
    }).catch(() => {});
  }, []);
  useEffect(() => {
    const syncTimer = setInterval(() => syncPendingAdminData().catch(() => {}), 30000);
    return () => clearInterval(syncTimer);
  }, []);
  const startTrip = (trip: TripPlan) => {
    setActiveTrip(trip); setScreen('ride');
    AsyncStorage.setItem(ACTIVE_TRIP_KEY, JSON.stringify(trip)).catch(() => {});
  };
  const completeTrip = async (trip: SavedTrip) => {
    const completedTrip = { ...trip, feedbackStatus: 'pending' as const };
    const next = [completedTrip, ...history];
    setHistory(next); setActiveTrip(null); setArrivedTrip(completedTrip); setJustArrived(true); setScreen('report');
    await Promise.all([
      AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next)),
      AsyncStorage.removeItem(ACTIVE_TRIP_KEY),
    ]);
  };
  const saveFeedbackStatus = (tripId: string, feedbackStatus: SavedTrip['feedbackStatus']) => {
    setHistory(current => {
      const next = current.map(trip => trip.id === tripId ? { ...trip, feedbackStatus } : trip);
      AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };
  const open = (next: Screen) => { if (next === 'route') setRouteSeed(null); setPrevious(screen); setScreen(next); };
  const goBack = () => setScreen(previous === screen ? 'home' : previous);
  const showNav = ['home', 'fare', 'history', 'profile'].includes(screen);
  const tab = (['home', 'fare', 'history', 'profile'].includes(screen) ? screen : 'home') as Tab;
  if (showOnboarding) return <OnboardingScreen onContinue={() => setShowOnboarding(false)} />;
  if (profile === undefined) return <View style={[s.flex, { backgroundColor: '#101510' }]} />;
  if (!profile) return <AuthScreen onAuthenticated={setProfile} />;

  return (
    <View style={s.app}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      {screen === 'home' && <HomeScreen open={open} privacyMode={privacyMode} satellite={satelliteMap} setSatellite={setSatelliteMap} tilt={tiltedMap} setTilt={setTiltedMap} chooseSpot={(spot) => {
        const index = TOURIST_SPOTS.findIndex(item => item.name === spot.name);
        setRouteSeed(TOURIST_FARE_DESTINATIONS[Math.max(0, index)]);
        setScreen('route');
      }} />}
      {screen === 'fare' && <FareCalculator open={open} />}
      {screen === 'terminals' && <TerminalsScreen satellite={satelliteMap} tilt={tiltedMap} goBack={() => setScreen('home')} directions={() => { setRouteSeed(AGOO_MARKET_FARE); setScreen('route'); }} />}
      {screen === 'history' && <HistoryScreen rides={history} />}
      {screen === 'profile' && <ProfileScreen open={open} profile={profile} theme={theme} setTheme={setTheme} logout={async () => {
        await AsyncStorage.removeItem(SESSION_KEY);
        setProfile(null); setScreen('home');
      }} />}
      {screen === 'matrix' && <FareMatrix goBack={goBack} satellite={satelliteMap} tilt={tiltedMap} />}
      {screen === 'report' && <ReportScreen profile={profile} postTrip={justArrived} trip={arrivedTrip} goBack={() => { setJustArrived(false); setScreen('home'); }} markReported={() => { if (arrivedTrip) saveFeedbackStatus(arrivedTrip.id, 'reported'); }} noProblem={() => { if (arrivedTrip) saveFeedbackStatus(arrivedTrip.id, 'no_problem'); setJustArrived(false); setScreen('home'); }} />}
      {screen === 'route' && <RouteScreen goBack={() => setScreen('home')} start={startTrip} initialDestination={routeSeed} satellite={satelliteMap} tilt={tiltedMap} privacyMode={privacyMode} />}
      {screen === 'ride' && activeTrip && <RideScreen trip={activeTrip} complete={completeTrip} satellite={satelliteMap} tilt={tiltedMap} privacyMode={privacyMode} />}
      {showNav && <BottomNav active={tab} set={(next) => setScreen(next)} profile={profile} theme={theme} />}
    </View>
  );
}

function OnboardingScreen({ onContinue }: { onContinue: () => void }) {
  const ride = useRef(new Animated.Value(0)).current;
  const { height, width } = useWindowDimensions();
  const compact = height < 720;
  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(ride, { toValue: 1, duration: 2600, useNativeDriver: true }),
      Animated.timing(ride, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, []);
  return <LinearGradient colors={['#073D2A', '#087C4D', '#0B9A5E']} style={s.onboardingPage}>
    <StatusBar style="light" />
    <SafeAreaView style={[s.onboardingSafe, compact && s.onboardingSafeCompact]} edges={['top', 'bottom']}>
      <View style={s.onboardingBrand}><View style={s.onboardingBrandIcon}><TricycleIcon size={27} color={C.green} /></View><Text style={s.onboardingBrandText}>TRI FARE AGOO</Text></View>
      <View style={[s.onboardingHero, compact && s.onboardingHeroCompact]}>
        <View style={s.onboardingGlow} />
        <Text style={s.onboardingKicker}>FAIR FARES. EASY ROUTES.</Text>
        <Text style={[s.onboardingTitle, compact && s.onboardingTitleCompact]}>Ride around Agoo with confidence.</Text>
        <Text style={s.onboardingSubtitle}>Check official tricycle fares, follow routes, and discover places near you.</Text>
        <View style={[s.onboardingRoad, compact && s.onboardingRoadCompact]}>
          <View style={s.onboardingRoadLine} />
          <Animated.View style={[s.onboardingTricycle, { transform: [{ translateX: ride.interpolate({ inputRange: [0, 1], outputRange: [-34, Math.max(190, width - 118)] }) }] }]}>
            <TricycleIcon size={54} color={C.white} />
          </Animated.View>
        </View>
      </View>
      <View style={s.onboardingFooter}>
        <Pressable accessibilityRole="button" style={s.onboardingButton} onPress={onContinue}>
          <Text style={s.onboardingButtonText}>Go Now</Text><ArrowRight size={20} color={C.green} />
        </Pressable>
        <Pressable accessibilityRole="link" onPress={() => Linking.openURL(DEVELOPER_PORTFOLIO)}><Text style={s.onboardingDeveloper}>Developer: <Text style={s.onboardingDeveloperName}>Jasmine Barnachea</Text></Text></Pressable>
      </View>
    </SafeAreaView>
  </LinearGradient>;
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: (profile: UserProfile) => void }) {
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(true);
  const [role, setRole] = useState<UserProfile['role']>('Agoo resident');
  const [photoUri, setPhotoUri] = useState('');
  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert('Photo access needed', 'Allow photo access to choose your profile picture.');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: .75, allowsEditing: true, aspect: [1, 1] });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  };
  const submit = async () => {
    if (!email.trim() || !password.trim() || (mode === 'signup' && !name.trim())) return Alert.alert('Complete your details', 'Enter your email and password.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return Alert.alert('Check your email', 'Enter a valid email address.');
    if (mode === 'signup') {
      if (!photoUri) return Alert.alert('Add a profile photo', 'Choose an image before creating your account.');
      const created: UserProfile = { name: name.trim(), email: email.trim().toLowerCase(), password, role, photoUri };
      await Promise.all([
        AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(created)),
        AsyncStorage.setItem(SESSION_KEY, 'true'),
      ]);
      const adminRecord: PendingAdminRecord = { clientId: `user-${created.email}`, fields: { name: created.name, email: created.email, role: created.role }, photoUri: created.photoUri };
      sendAdminRecord('/api/users', adminRecord)
        .catch(() => queueAdminRecord(PENDING_USERS_KEY, adminRecord))
        .catch(() => {});
      onAuthenticated(created);
      return;
    }
    const saved = await AsyncStorage.getItem(PROFILE_KEY);
    const account = saved ? JSON.parse(saved) as UserProfile : null;
    if (!account || account.email?.toLowerCase() !== email.trim().toLowerCase() || account.password !== password) {
      return Alert.alert('Login failed', 'The email or password does not match the account saved on this phone.');
    }
    await AsyncStorage.setItem(SESSION_KEY, 'true');
    onAuthenticated(account);
  };
  return <KeyboardAvoidingView style={s.authPage} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <StatusBar style="light" />
    <View style={s.authGlow} />
    <SafeAreaView style={s.authSafe} edges={['top', 'bottom']}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={s.authScroll}>
      <View><Text style={s.authKicker}>TRI FARE AGOO</Text><Text style={s.authTitle}>{mode === 'signup' ? 'Welcome aboard.' : 'Welcome back.'}</Text>
        <Text style={s.authSubtitle}>Fair routes, official fares, and safer trips around Agoo.</Text></View>
      <View style={s.authCard}>
        {mode === 'signup' && <Pressable style={s.authPhoto} onPress={pickPhoto}>
          {photoUri ? <Image source={{ uri: photoUri }} style={s.authPhotoImage} /> : <><Camera color="#8FE2B5" size={27} /><Text style={s.authPhotoText}>Add photo</Text></>}
        </Pressable>}
        {mode === 'signup' && <TextInput value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor="#758078" style={s.authInput} />}
        <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="Email address" placeholderTextColor="#758078" style={s.authInput} />
        {mode === 'signup' && <View style={s.authRoleRow}>
          {(['Agoo resident', 'Tourist'] as const).map(item => <Pressable key={item} onPress={() => setRole(item)} style={[s.authRole, role === item && s.authRoleActive]}>
            <Text style={[s.authRoleText, role === item && { color: C.white }]}>{item}</Text>
          </Pressable>)}
        </View>}
        <View style={s.authPasswordRow}><TextInput value={password} onChangeText={setPassword} secureTextEntry={!showPassword} autoCapitalize="none" placeholder="Password" placeholderTextColor="#758078" style={s.authPasswordInput} />
          <Pressable accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} onPress={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff color="#9FAAA2" size={21} /> : <Eye color="#9FAAA2" size={21} />}</Pressable>
        </View>
        <Pressable style={s.authSubmit} onPress={submit}><Text style={s.buttonWhite}>{mode === 'signup' ? 'Create account' : 'Log in'}</Text><ArrowRight color="white" size={19} /></Pressable>
        <Pressable onPress={() => setMode(value => value === 'signup' ? 'login' : 'signup')}><Text style={s.authSwitch}>
          {mode === 'signup' ? 'Already registered? Log in' : 'New to Tri Fare Agoo? Sign up'}
        </Text></Pressable>
      </View>
      <Text style={s.authPrivacy}>Your profile is stored privately on this device.</Text>
      </ScrollView>
    </SafeAreaView>
  </KeyboardAvoidingView>;
}

function AppMap({ markers = true, route = false, routePoints, pinnedPoint, displayLocation, follow = false, satellite = false, traffic = false, tilt = true, touristSpots = false, touristSpotItems = TOURIST_SPOTS, selectedSpot, onSpotPress, onMapPress }: { markers?: boolean; route?: boolean; routePoints?: RoutePoint[]; pinnedPoint?: RoutePoint | null; displayLocation?: RoutePoint; follow?: boolean; satellite?: boolean; traffic?: boolean; tilt?: boolean; touristSpots?: boolean; touristSpotItems?: TouristSpot[]; selectedSpot?: TouristSpot; onSpotPress?: (spot: TouristSpot) => void; onMapPress?: (point: RoutePoint) => void }) {
  const map = useRef<MapView>(null);
  const [region, setRegion] = useState(AGOO);
  const [permission, setPermission] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<RoutePoint | null>(null);
  const [previewRoute, setPreviewRoute] = useState<RoutePoint[]>([]);
  useEffect(() => {
    let watcher: Location.LocationSubscription | undefined;
    (async () => {
      const result = await Location.requestForegroundPermissionsAsync();
      if (result.status !== 'granted') return;
      setPermission(true);
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCurrentLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      const next = { ...region, latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      if (follow) { setRegion(next); map.current?.animateToRegion(next, 650); }
      watcher = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 10 },
        ({ coords }) => {
          const point = { latitude: coords.latitude, longitude: coords.longitude };
          setCurrentLocation(point);
          if (follow) map.current?.animateCamera({ center: point }, { duration: 500 });
        }
      );
    })();
    return () => watcher?.remove();
  }, [follow]);
  useEffect(() => {
    if (!selectedSpot) return;
    map.current?.animateCamera({ center: selectedSpot, pitch: 58, heading: 12, altitude: 950, zoom: 16 }, { duration: 850 });
  }, [selectedSpot]);
  useEffect(() => {
    if (!routePoints || routePoints.length < 2) { setPreviewRoute([]); return; }
    map.current?.fitToCoordinates(routePoints, { edgePadding: { top: 120, right: 55, bottom: 330, left: 55 }, animated: true });
    const tiltTimer = tiltMapCamera(map.current, tilt ? 50 : 0, 750);
    let shown = 1;
    setPreviewRoute(routePoints.slice(0, shown));
    const step = Math.max(1, Math.ceil(routePoints.length / 70));
    const timer = setInterval(() => {
      shown = Math.min(routePoints.length, shown + step);
      setPreviewRoute(routePoints.slice(0, shown));
      if (shown >= routePoints.length) clearInterval(timer);
    }, 30);
    return () => { clearInterval(timer); clearTimeout(tiltTimer); };
  }, [routePoints, tilt]);
  return (
    <MapView
      ref={map}
      style={StyleSheet.absoluteFill}
      provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
      initialRegion={region}
      showsUserLocation={false}
      showsMyLocationButton={false}
      pitchEnabled rotateEnabled
      mapType={satellite ? 'hybrid' : 'standard'}
      userInterfaceStyle={darkModeActive ? 'dark' : 'light'}
      customMapStyle={darkModeActive ? DARK_MAP_STYLE : []}
      showsTraffic={traffic}
      showsCompass={false}
      legalLabelInsets={touristSpots && Platform.OS === 'ios' ? { top: 0, right: 0, bottom: 126, left: 18 } : undefined}
      onPress={({ nativeEvent }) => onMapPress?.(nativeEvent.coordinate)}
      camera={{ center: { latitude: region.latitude, longitude: region.longitude }, pitch: tilt ? 58 : 0, heading: tilt ? 8 : 0, altitude: 1800, zoom: 15 }}
    >
      {markers && TERMINALS.map((t, i) => (
        <Marker key={t.name} coordinate={t} title={t.name}>
          <View style={[s.mapPin, i === 1 && { backgroundColor: C.blue }]}><TricycleIcon color="white" size={20} /></View>
        </Marker>
      ))}
      {touristSpots && selectedSpot && <Marker coordinate={selectedSpot} title={selectedSpot.name} onPress={() => onSpotPress?.(selectedSpot)}>
        <PulsingDestinationMarker />
      </Marker>}
      {pinnedPoint && <Marker coordinate={pinnedPoint} title="Pinned destination"><View style={s.pinnedMapIcon}><MapPin color="white" size={22} fill="white" /></View></Marker>}
      {displayLocation && !routePoints?.length && <Marker coordinate={displayLocation} title="Approximate location"><View style={s.privateLocationMarker}><View style={s.privateLocationDot} /></View></Marker>}
      {permission && currentLocation && !displayLocation && !routePoints?.length ? <Marker coordinate={currentLocation} anchor={{ x: .5, y: .5 }} flat zIndex={20}><CurrentLocationMarker /></Marker> : null}
      {previewRoute.length > 1 && <>
        <Polyline coordinates={previewRoute} strokeColor="rgba(20,35,45,.72)" strokeWidth={10} />
        <Polyline coordinates={previewRoute} strokeColor="#39A9E8" strokeWidth={6} lineCap="round" lineJoin="round" />
        <Marker coordinate={previewRoute[0]} anchor={{ x: .5, y: .5 }} flat zIndex={20}>
          <CurrentLocationMarker />
        </Marker>
      </>}
      {route && <Polyline coordinates={routeLine} strokeColor={C.green} strokeWidth={6} />}
    </MapView>
  );
}

function ExploreDestinationCard({ spot, selected, distanceKm, etaMinutes, onPress, onGo, showGo = true }: { spot: TouristSpot; selected: boolean; distanceKm: number | null; etaMinutes?: number; onPress: () => void; onGo: () => void; showGo?: boolean }) {
  const interaction = useRef(new Animated.Value(0)).current;
  const animate = (toValue: number) => Animated.spring(interaction, {
    toValue,
    useNativeDriver: true,
    damping: 15,
    stiffness: 210,
    mass: .7,
  }).start();
  return <Animated.View style={[s.destinationCardOuter, selected && s.destinationCardSelected, {
    transform: [{ scale: interaction.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] }) }],
  }]}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Explore ${spot.name}`} onPress={onPress} onPressIn={() => animate(1)} onPressOut={() => animate(0)} style={s.destinationCard}>
      <Animated.Image source={VERIFIED_PLACE_PHOTOS[spot.name]} style={[s.destinationCardImage, {
        transform: [{ scale: interaction.interpolate({ inputRange: [0, 1], outputRange: [1, 1.11] }) }],
      }]} />
      <LinearGradient colors={['transparent', 'rgba(8,58,39,.56)', 'rgba(5,45,30,.97)']} locations={[0, .48, 1]} style={StyleSheet.absoluteFill} />
      {showGo && <Pressable accessibilityLabel={`Go to ${spot.name}`} style={s.destinationCardGo} onPress={(event) => { event.stopPropagation(); onGo(); }}><Navigation size={18} color={C.white} fill={C.white} /></Pressable>}
      <View style={s.destinationCardContent}>
        <Text numberOfLines={2} style={s.destinationCardTitle}>{spot.name}</Text>
        <Text style={s.destinationCardStats}>{distanceKm == null ? 'Calculating route…' : `${distanceKm.toFixed(1)} km${etaMinutes ? ` · ${etaMinutes} min` : ''} from you`}</Text>
      </View>
    </Pressable>
  </Animated.View>;
}

function HomeScreen({ open, chooseSpot, satellite, setSatellite, tilt, setTilt, privacyMode }: { open: (s: Screen) => void; chooseSpot: (spot: TouristSpot) => void; satellite: boolean; setSatellite: React.Dispatch<React.SetStateAction<boolean>>; tilt: boolean; setTilt: React.Dispatch<React.SetStateAction<boolean>>; privacyMode: boolean }) {
  const [currentLabel, setCurrentLabel] = useState('Finding your location…');
  const [selectedSpot, setSelectedSpot] = useState<TouristSpot>(TOURIST_SPOTS[0]);
  const [focusedExploreCard, setFocusedExploreCard] = useState(false);
  const [origin, setOrigin] = useState<RoutePoint>({ latitude: AGOO.latitude, longitude: AGOO.longitude });
  const [locationReady, setLocationReady] = useState(false);
  const [homeRoute, setHomeRoute] = useState<RoutePoint[]>([]);
  const [spotRouteMetrics, setSpotRouteMetrics] = useState<Record<string, { distanceKm: number; etaMinutes: number }>>({});
  const [spotDetails, setSpotDetails] = useState<Record<string, AgooPlace>>({});
  const homeSheetY = useRef(new Animated.Value(0)).current;
  const homeSheetOffset = useRef(0);
  const settleHomeSheet = (collapsed: boolean) => {
    const target = collapsed ? 205 : 0;
    homeSheetOffset.current = target;
    Animated.spring(homeSheetY, { toValue: target, useNativeDriver: true, damping: 21, stiffness: 180 }).start();
  };
  const homeSheetPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 8,
    onMoveShouldSetPanResponderCapture: (_, gesture) => Math.abs(gesture.dy) > 5,
    onPanResponderMove: (_, gesture) => homeSheetY.setValue(Math.max(0, Math.min(205, homeSheetOffset.current + gesture.dy))),
    onPanResponderRelease: (_, gesture) => settleHomeSheet(homeSheetOffset.current + gesture.dy > 95 || gesture.vy > .65),
  })).current;
  const verifiedSpots = useMemo(() => HOME_MAP_SPOTS.map(spot => {
    const location = spotDetails[spot.name]?.location;
    return location ? { ...spot, ...location } : spot;
  }), [spotDetails]);
  const verifiedSelected = verifiedSpots.find(spot => spot.name === selectedSpot.name) ?? selectedSpot;
  useEffect(() => {
    (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') { setCurrentLabel('Location permission needed'); return; }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const current = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      setOrigin(current);
      setLocationReady(true);
      setCurrentLabel('Agoo, La Union');
      const metrics = await Promise.all(EXPLORE_PLACES.map(async spot => {
        try {
          const route = await computeRoute(current, { latitude: spot.latitude, longitude: spot.longitude });
          return route ? [spot.name, { distanceKm: route.distanceKm, etaMinutes: route.durationMinutes }] as const : null;
        } catch { return null; }
      }));
      setSpotRouteMetrics(Object.fromEntries(metrics.filter((item): item is NonNullable<typeof item> => item !== null)));
    })().catch(() => setCurrentLabel('Agoo, La Union'));
  }, []);
  const animateHomeRoute = async (destination: RoutePoint | string) => {
    setHomeRoute([]);
    try {
      const visibleOrigin = privacyMode ? AGOO : origin;
      const result = await computeRoute(visibleOrigin, destination);
      if (!result?.points.length) throw new Error('No route returned');
      setHomeRoute(result.points);
    } catch {
      const point = typeof destination === 'string' ? null : destination;
      if (point) setHomeRoute([privacyMode ? AGOO : origin, point]);
    }
  };
  const selectHomeSpot = (spot: TouristSpot, focusCard = false) => {
    setSelectedSpot(spot);
    setFocusedExploreCard(focusCard && Boolean(VERIFIED_PLACE_PHOTOS[spot.name]));
    animateHomeRoute({ latitude: spot.latitude, longitude: spot.longitude });
    settleHomeSheet(!focusCard);
  };
  return (
    <View style={s.flex}>
      <View style={s.mapArea}><AppMap markers={false} displayLocation={privacyMode ? AGOO : undefined} follow={!privacyMode} satellite={satellite} traffic tilt={tilt} touristSpots touristSpotItems={verifiedSpots} selectedSpot={verifiedSelected} onSpotPress={selectHomeSpot} routePoints={homeRoute.length ? [privacyMode ? AGOO : origin, ...homeRoute] : []} /></View>
      <SafeAreaView style={s.homeOverlay} edges={['top']}>
        <View style={s.homeExploreHeading}>
          <Text style={s.exploreKicker}>DISCOVER AGOO</Text>
          <Text style={s.mapAttribution}>Routes © openrouteservice · Data © OpenStreetMap contributors</Text>
        </View>
        <View style={s.mapTools}>
          <Tool icon={<Layers3 size={20} color={darkModeActive ? C.white : C.ink} />} onPress={() => setSatellite(x => !x)} />
          <Tool icon={<LocateFixed size={20} color={C.blue} />} onPress={() => Alert.alert('Live location', 'The map is following your current GPS location.')} />
          <Tool label={tilt ? '3D' : '2D'} onPress={() => setTilt(x => !x)} />
        </View>
      </SafeAreaView>
      <View style={s.homeSheetViewport} pointerEvents="box-none">
      <Animated.View {...homeSheetPan.panHandlers} style={[s.homeExploreSheet, focusedExploreCard && s.homeExploreSheetFocused, { transform: [{ translateY: homeSheetY }] }]}>
        <Pressable hitSlop={8} style={s.dragHandleArea} onPress={() => settleHomeSheet(homeSheetOffset.current === 0)}><View style={s.handle} /></Pressable>
        {focusedExploreCard ? <View style={s.focusedExploreRow}>
          <ExploreDestinationCard spot={selectedSpot} selected showGo={false} distanceKm={spotRouteMetrics[selectedSpot.name]?.distanceKm ?? (locationReady ? distanceMetres(origin, selectedSpot) / 1000 : null)} etaMinutes={spotRouteMetrics[selectedSpot.name]?.etaMinutes} onPress={() => setFocusedExploreCard(false)} onGo={() => chooseSpot(selectedSpot)} />
          <View style={s.focusedExploreDetails}><Pressable accessibilityLabel="Back to all Explore places" onPress={() => setFocusedExploreCard(false)} style={s.focusedExploreBack}><ArrowLeft size={17} color={darkModeActive ? C.white : C.ink} /><Text style={s.focusedExploreBackText}>All places</Text></Pressable><Text style={s.placeCategory}>{selectedSpot.category}</Text><Text style={s.focusedExploreTitle}>{selectedSpot.name}</Text><Text numberOfLines={4} style={s.focusedExploreDescription}>{selectedSpot.description}</Text></View>
        </View> : <FlatList horizontal data={EXPLORE_PLACES} keyExtractor={item => item.name} showsHorizontalScrollIndicator={false}
          snapToInterval={152} decelerationRate="fast"
          contentContainerStyle={{ gap: 12, paddingTop: 4, paddingRight: 4, paddingBottom: 14 }}
          renderItem={({ item }) => <ExploreDestinationCard spot={item} selected={selectedSpot.name === item.name}
            distanceKm={spotRouteMetrics[item.name]?.distanceKm ?? (locationReady ? distanceMetres(origin, item) / 1000 : null)} etaMinutes={spotRouteMetrics[item.name]?.etaMinutes} onPress={() => selectHomeSpot(item, true)} onGo={() => chooseSpot(item)} />} />}
        {focusedExploreCard && <Pressable style={s.exploreGoButton} onPress={() => chooseSpot(selectedSpot)}>
          <Navigation color={C.white} size={18} fill={C.white} />
          <Text style={s.buttonWhite}>Go to {selectedSpot.name}</Text>
          <ChevronRight color={C.white} size={18} />
        </Pressable>}
        {!focusedExploreCard && <View style={s.placeHeader}>
          <View style={s.grow}><Text style={s.placeCategory}>{selectedSpot.category}</Text><Text style={s.placeTitle}>{selectedSpot.name}</Text></View>
        </View>}
        {spotDetails[selectedSpot.name]?.rating ? <View style={s.placeMeta}><Text style={s.placeRating}>★ {spotDetails[selectedSpot.name].rating?.toFixed(1)} · {spotDetails[selectedSpot.name].reviewCount ?? 0} reviews</Text></View> : null}
        {!focusedExploreCard && <Pressable style={s.homeWhereTo} onPress={() => open('route')}>
          <Search color="#99A29B" size={23} />
          <View style={s.grow}><Text style={s.homeWhereTitle}>Where are you headed?</Text><Text numberOfLines={1} style={s.homeWhereLocation}>From {currentLabel}</Text></View>
          <View style={s.homeGoCircle}><Navigation color="white" size={18} fill="white" /></View>
        </Pressable>}
      </Animated.View>
      </View>
    </View>
  );
}

function RouteScreen({ goBack, start, initialDestination, satellite, tilt, privacyMode }: { goBack: () => void; start: (trip: TripPlan) => void; initialDestination?: FareEntry | null; satellite: boolean; tilt: boolean; privacyMode: boolean }) {
  const map = useRef<MapView>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<FareEntry>(initialDestination ?? { barangay: 'Choose destination', distance: '0', regular: 0, special: 0 });
  const [customPoint, setCustomPoint] = useState<RoutePoint | null>(null);
  const [customName, setCustomName] = useState('');
  const [places, setPlaces] = useState<AgooPlace[]>([]);
  const [pinMode, setPinMode] = useState(false);
  const [result, setResult] = useState<RouteResult | null>(null);
  const [animatedRoute, setAnimatedRoute] = useState<RoutePoint[]>([]);
  const [origin, setOrigin] = useState<RoutePoint>({ latitude: AGOO.latitude, longitude: AGOO.longitude });
  const [loading, setLoading] = useState(false);
  const [special, setSpecial] = useState(false);
  const routeSheetY = useRef(new Animated.Value(0)).current;
  const routeSheetOffset = useRef(0);
  const settleRouteSheet = (collapsed: boolean) => {
    const target = collapsed ? 275 : 0; routeSheetOffset.current = target;
    Animated.spring(routeSheetY, { toValue: target, useNativeDriver: true, damping: 21, stiffness: 180 }).start();
  };
  const routePan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 8,
    onMoveShouldSetPanResponderCapture: (_, gesture) => Math.abs(gesture.dy) > 5,
    onPanResponderMove: (_, gesture) => routeSheetY.setValue(Math.max(0, Math.min(275, routeSheetOffset.current + gesture.dy))),
    onPanResponderRelease: (_, gesture) => settleRouteSheet(routeSheetOffset.current + gesture.dy > 130 || gesture.vy > .7),
  })).current;
  const matches = query.trim() ? SEARCHABLE_DESTINATIONS.filter(x => x.barangay.toLowerCase().includes(query.toLowerCase())).slice(0, 20) : [];
  const routedKm = result?.distanceKm ?? Number(selected.distance.split('/')[0].trim());
  const computed = 20 + Math.max(0, routedKm - 4) * 2;
  const computedRegular = Math.max(20, Math.round(computed));
  const regularFare = customPoint ? computedRegular : selected.regular;
  const specialFare = customPoint ? Math.round(computedRegular * .8) : selected.special;
  const fare = special ? specialFare : regularFare;
  const destinationName = customName || selected.barangay;
  const matrixSource = customPoint ? 'Distance-based ordinance calculation'
    : selected.barangay.includes('Eco') ? 'Sta. Rita Central fare entry'
    : selected.barangay.includes('Basilica') || selected.barangay.includes('Museo') || selected.barangay.includes('Plaza') || selected.barangay.includes('Municipal')
      ? 'Town proper / first 4 km base fare' : `${selected.barangay} fare entry`;
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length >= 2) searchAgooPlaces(query).then(setPlaces).catch(() => setPlaces([]));
      else setPlaces([]);
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    if (!result?.points.length) { setAnimatedRoute([]); return; }
    let shown = 2;
    setAnimatedRoute(result.points.slice(0, shown));
    const step = Math.max(1, Math.ceil(result.points.length / 55));
    const timer = setInterval(() => {
      shown = Math.min(result.points.length, shown + step);
      setAnimatedRoute(result.points.slice(0, shown));
      if (shown >= result.points.length) clearInterval(timer);
    }, 22);
    return () => clearInterval(timer);
  }, [result]);
  const loadRoute = async (entry: FareEntry) => {
    setSelected(entry); setCustomPoint(null); setCustomName(''); setQuery(''); setPlaces([]); setLoading(true); setResult(null);
    try {
      let startPoint = privacyMode ? AGOO : origin;
      if (!privacyMode) {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        startPoint = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setOrigin(startPoint);
        }
      } else {
        setOrigin(AGOO);
      }
      const route = await computeRoute(startPoint, exactTouristPoint(entry.barangay) ?? `${entry.barangay}, Agoo, La Union, Philippines`);
      setResult(route);
      if (route?.points.length) {
        map.current?.fitToCoordinates(route.points, { edgePadding: { top: 130, right: 55, bottom: 340, left: 55 }, animated: true });
        tiltMapCamera(map.current, tilt ? 50 : 0, 800);
      }
    } catch {
      Alert.alert('Could not load the road route', 'Check the openrouteservice key and your internet connection, then try again.');
    } finally { setLoading(false); }
  };
  const loadPointRoute = async (point: RoutePoint, name: string) => {
    setPinMode(false); setCustomPoint(point); setCustomName(name); setQuery(''); setPlaces([]); setLoading(true); setResult(null);
    try {
      let startPoint = privacyMode ? AGOO : origin;
      if (!privacyMode) {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        startPoint = { latitude: pos.coords.latitude, longitude: pos.coords.longitude }; setOrigin(startPoint);
        }
      } else {
        setOrigin(AGOO);
      }
      const route = await computeRoute(startPoint, point); setResult(route);
      if (route?.points.length) {
        map.current?.fitToCoordinates(route.points, { edgePadding: { top: 130, right: 55, bottom: 360, left: 55 }, animated: true });
        tiltMapCamera(map.current, tilt ? 50 : 0, 800);
      }
    } catch { Alert.alert('Route unavailable', 'Could not calculate a road route to this pin.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (initialDestination) loadRoute(initialDestination); }, []);
  const beginTrip = () => {
    if (!result?.points.length) {
      Alert.alert('Road route required', 'Add the openrouteservice key, then reload this destination before starting GPS tracking.');
      return;
    }
    start({
      destination: destinationName,
      origin,
      destinationPoint: result.points[result.points.length - 1],
      route: result.points,
      routeDistanceKm: result.distanceKm,
      etaMinutes: result.durationMinutes,
      fare,
      special,
    });
  };
  return (
    <View style={[s.flex, { backgroundColor: '#111411' }]}>
      <MapView ref={map} style={StyleSheet.absoluteFill} provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        mapType={satellite ? 'hybrid' : 'standard'} showsTraffic showsBuildings showsUserLocation={false} showsCompass={false}
        userInterfaceStyle={darkModeActive ? 'dark' : 'light'} customMapStyle={darkModeActive ? DARK_MAP_STYLE : []}
        pitchEnabled rotateEnabled
        onPress={({ nativeEvent }) => { if (pinMode) loadPointRoute(nativeEvent.coordinate, 'Pinned destination'); }}
        initialCamera={{ center: origin, pitch: tilt ? 50 : 0, heading: tilt ? 8 : 0, altitude: 1800, zoom: 15 }}>
        {animatedRoute.length > 1 ? <>
          <Polyline coordinates={[privacyMode ? AGOO : origin, ...animatedRoute]} strokeColor="rgba(20,35,45,.72)" strokeWidth={10} />
          <Polyline coordinates={[privacyMode ? AGOO : origin, ...animatedRoute]} strokeColor="#39A9E8" strokeWidth={6} lineCap="round" lineJoin="round" />
        </> : null}
        <Marker coordinate={privacyMode ? AGOO : origin} anchor={{ x: .5, y: .5 }} zIndex={20}>
          <CurrentLocationMarker />
        </Marker>
        {result?.points.length ? <Marker coordinate={result.points[result.points.length - 1]} title={destinationName}><PulsingDestinationMarker /></Marker> : null}
      </MapView>
      <SafeAreaView style={s.routeTopSafe} edges={['top']} pointerEvents="box-none">
        <View style={s.routeTopRow}>
          <Pressable accessibilityLabel="Back" onPress={goBack} style={s.routeBackButton}><ArrowLeft size={22} color={darkModeActive ? C.white : C.ink} /></Pressable>
          <View style={s.routeSearch}>
            <Search color={C.muted} size={19} />
            <TextInput value={query} onChangeText={setQuery} placeholder="Where to?" placeholderTextColor="#A5ADA7" style={s.routeInput} />
            {query ? <Pressable onPress={() => setQuery('')}><X size={19} color={C.muted} /></Pressable> : null}
          </View>
        </View>
        {(matches.length > 0 || places.length > 0) && <ScrollView style={s.searchResults} keyboardShouldPersistTaps="handled" nestedScrollEnabled>{matches.map(item =>
          <Pressable key={item.barangay} style={s.searchResult} onPress={() => loadRoute(item)}>
            <MapPin size={18} color="#39C4F3" /><View style={s.grow}><Text style={s.searchResultTitle}>{item.barangay}</Text><Text style={s.searchResultCaption}>{item.distance} km · matrix fare {peso(item.regular)}</Text></View><ChevronRight size={18} color="#A5ADA7" />
          </Pressable>)}
          {places.filter(p => !matches.some(m => p.name.toLowerCase() === m.barangay.toLowerCase())).map(place =>
            <Pressable key={place.id} style={s.searchResult} onPress={() => loadPointRoute(place.location, place.name)}>
              <MapPin size={18} color="#39C4F3" /><View style={s.grow}><Text style={s.searchResultTitle}>{place.name}</Text><Text numberOfLines={1} style={s.searchResultCaption}>{place.address}</Text></View><ChevronRight size={18} color="#A5ADA7" />
            </Pressable>)}</ScrollView>}
      </SafeAreaView>
      <View pointerEvents="none" style={s.routeAttribution}><Text style={s.mapAttribution}>Routes © openrouteservice · Data © OpenStreetMap contributors</Text></View>
      <Pressable accessibilityLabel={pinMode ? 'Cancel pin location' : 'Pin location'} style={[s.pinLocationButton, pinMode && s.pinLocationButtonActive]} onPress={() => setPinMode(value => !value)}>
        <MapPinned size={21} color={pinMode || darkModeActive ? C.white : C.ink} />
      </Pressable>
      <Animated.View style={[s.panoRouteCard, { transform: [{ translateY: routeSheetY }] }]}>
        <Pressable {...routePan.panHandlers} hitSlop={8} style={s.dragHandleArea} onPress={() => settleRouteSheet(routeSheetOffset.current === 0)}><View style={s.handle} /></Pressable>
        <ScrollView style={s.routeCardScroll} showsVerticalScrollIndicator={false} nestedScrollEnabled contentContainerStyle={s.routeCardContent}>
        <View style={s.placeHeader}><View style={s.grow}><Text style={s.placeCategory}>TRICYCLE ROUTE</Text><Text style={s.placeTitle}>{destinationName}</Text></View>
          {loading ? <ActivityIndicator color="white" /> : <View style={s.darkCircleSmall}><TricycleIcon color="white" size={23} /></View>}
        </View>
        <View style={s.routeMetrics}>
          <Stat label="ROAD DISTANCE" value={`${routedKm.toFixed(1)} km`} green />
          <Stat label="ETA" value={result ? `${result.durationMinutes} min` : '—'} green />
          <Stat label={customPoint ? 'EST. FARE' : 'OFFICIAL FARE'} value={peso(fare)} green />
        </View>
        <View style={s.matrixFareBox}>
          <View style={s.rowBetween}><View style={s.row}><TricycleIcon color="#3ACB80" size={23} /><View><Text style={s.matrixFareTitle}>Calculated matrix fare</Text><Text style={s.matrixFareSource}>{matrixSource}</Text></View></View><Text style={s.matrixFareTotal}>{peso(fare)}</Text></View>
          <View style={s.matrixDivider} />
          <View style={s.rowBetween}><Text style={s.matrixSmall}>Regular passenger</Text><Text style={s.matrixValue}>{peso(regularFare)}</Text></View>
          <View style={s.rowBetween}><Text style={s.matrixSmall}>Student / Senior / PWD</Text><Text style={[s.matrixValue, { color: '#3ACB80' }]}>{peso(specialFare)}</Text></View>
        </View>
        <View style={s.specialRow}><View><Text style={s.cardTitle}>Student / Senior / PWD</Text><Text style={s.caption}>Apply ordinance special fare</Text></View><Switch value={special} onValueChange={setSpecial} trackColor={{ true: C.green }} /></View>
        <Text style={s.routeNotice}>{result
          ? customPoint ? `Destination confirmed · ${peso(fare)} calculated from ${routedKm.toFixed(1)} routed km using the ordinance distance rule.` : `Destination confirmed · ${peso(fare)} matched from the official fare matrix.`
          : 'Select a result or long-press the map to calculate the route.'}</Text>
        <Pressable style={[s.startRideButton, !result && { opacity: .48 }]} onPress={beginTrip}><TricycleIcon color="white" size={23} /><Text style={s.buttonWhite}>Go now · {peso(fare)}</Text></Pressable>
        <Text style={s.pinHint}>Not sure of the place? Use Pin location, then tap the destination on the map.</Text>
        </ScrollView>
      </Animated.View>
    </View>
  );
}

function RideScreen({ trip, complete, satellite, tilt, privacyMode }: { trip: TripPlan; complete: (trip: SavedTrip) => void; satellite: boolean; tilt: boolean; privacyMode: boolean }) {
  const map = useRef<MapView>(null);
  const [current, setCurrent] = useState<RoutePoint>(trip.origin);
  const [trackedMetres, setTrackedMetres] = useState(0);
  const [movingSpeedKph, setMovingSpeedKph] = useState(22);
  const previousPoint = useRef<RoutePoint>(trip.origin);
  const animatedPosition = useRef(new AnimatedRegion({
    latitude: (privacyMode ? AGOO : trip.origin).latitude,
    longitude: (privacyMode ? AGOO : trip.origin).longitude,
    latitudeDelta: 0,
    longitudeDelta: 0,
  })).current;
  useEffect(() => {
    let watcher: Location.LocationSubscription | undefined;
    (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Location is required', 'Enable location permission to track this trip and activate Arrive.');
        return;
      }
      watcher = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 3 },
        ({ coords }) => {
          const next = { latitude: coords.latitude, longitude: coords.longitude };
          const step = distanceMetres(previousPoint.current, next);
          if ((coords.accuracy ?? 999) <= 50 && step >= 1 && step <= 100) setTrackedMetres(total => total + step);
          const gpsSpeedKph = Math.max(0, (coords.speed ?? 0) * 3.6);
          if ((coords.accuracy ?? 999) <= 50 && gpsSpeedKph >= 3 && gpsSpeedKph <= 60) {
            setMovingSpeedKph(previous => previous * .7 + gpsSpeedKph * .3);
          }
          previousPoint.current = next;
          setCurrent(next);
          const displayPoint = privacyMode ? AGOO : next;
          animatedPosition.timing({ ...displayPoint, latitudeDelta: 0, longitudeDelta: 0, duration: 900, useNativeDriver: false } as any).start();
        },
      );
    })();
    return () => watcher?.remove();
  }, []);
  const directToDestination = distanceMetres(current, trip.destinationPoint);
  const routeIndex = nearestRouteIndex(trip.route, current);
  const traveledRoute = [...trip.route.slice(0, routeIndex + 1), current];
  const remainingRoute = [current, ...trip.route.slice(routeIndex + 1)];
  const remainingMetres = routeRemainingMetres(trip.route, current);
  const arrived = directToDestination <= 30;
  const progress = Math.min(1, Math.max(0, 1 - remainingMetres / Math.max(1, trip.routeDistanceKm * 1000)));
  const remainingMinutes = Math.max(1, Math.ceil((remainingMetres / 1000) / Math.max(8, movingSpeedKph) * 60));
  const finish = () => {
    const drivenKm = Math.max(0, trackedMetres / 1000);
    complete({
      id: `${Date.now()}`,
      destination: trip.destination,
      completedAt: new Date().toISOString(),
      distanceKm: drivenKm,
      fare: trip.fare,
    });
  };
  const confirmArrival = () => {
    if (arrived) { finish(); return; }
    Alert.alert(
      'You are not at the destination yet',
      `GPS shows ${remainingMetres < 1000 ? `${Math.round(remainingMetres)} m` : `${(remainingMetres / 1000).toFixed(1)} km`} remaining. Mark this trip complete anyway?`,
      [{ text: 'Keep riding', style: 'cancel' }, { text: 'Complete trip', style: 'destructive', onPress: finish }],
    );
  };
  return (
    <View style={[s.flex, { backgroundColor: '#111411' }]}>
      <MapView ref={map} style={StyleSheet.absoluteFill} provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        mapType={satellite ? 'hybrid' : 'standard'} showsTraffic showsBuildings showsCompass={false} zoomEnabled scrollEnabled rotateEnabled pitchEnabled
        userInterfaceStyle={darkModeActive ? 'dark' : 'light'} customMapStyle={darkModeActive ? DARK_MAP_STYLE : []}
        initialCamera={{ center: privacyMode ? AGOO : trip.origin, pitch: tilt ? 50 : 0, heading: 0, altitude: 260, zoom: 17 }}>
        <Polyline coordinates={trip.route} strokeColor="rgba(20,35,45,.72)" strokeWidth={11} />
        {traveledRoute.length > 1 && <Polyline coordinates={traveledRoute} strokeColor="rgba(205,218,222,.78)" strokeWidth={7} />}
        {remainingRoute.length > 1 && <Polyline coordinates={remainingRoute} strokeColor="#39A9E8" strokeWidth={7} lineCap="round" lineJoin="round" />}
        <Marker.Animated coordinate={animatedPosition as any} anchor={{ x: .5, y: .5 }} flat>
          <NavigationArrow heading={0} />
        </Marker.Animated>
        <Marker coordinate={trip.destinationPoint} title={trip.destination}><View style={s.destinationMarker}><Flag color="white" size={18} fill="white" /></View></Marker>
      </MapView>
      <View pointerEvents="none" style={s.rideAttribution}><Text style={s.mapAttribution}>Routes © openrouteservice · Data © OpenStreetMap contributors</Text></View>
      <SafeAreaView style={s.rideStats} edges={['top']}>
        <View style={s.statsCard}>
          <Stat label="TRIP TIME" value={`${remainingMinutes} min`} green /><Stat label="DRIVEN KM" value={`${(trackedMetres / 1000).toFixed(2)} km`} green /><Stat label="LIVE FARE" value={peso(trip.fare)} green />
        </View>
      </SafeAreaView>
      <View style={s.rideSheet}>
        <View style={s.rowBetween}><View style={s.grow}><Text style={s.cardTitle}>{trip.destination}</Text><Text style={s.caption}>{remainingMetres < 1000 ? `${Math.round(remainingMetres)} m` : `${(remainingMetres / 1000).toFixed(1)} km`} remaining · about {remainingMinutes} min</Text></View><View style={s.liveDot} /></View>
        <View style={s.progressTrack}><View style={[s.progressFill, { width: `${progress * 100}%` }]} /></View>
        <View style={s.row}>
          <Pressable style={[s.actionButton, { backgroundColor: C.mint }]} onPress={() => Share.share({
            title: 'My Tri Fare Agoo trip',
            message: `I’m riding to ${trip.destination}.\n\nMy current location:\nhttps://www.google.com/maps?q=${current.latitude},${current.longitude}\n\nShared from Tri Fare Agoo.`,
          })}><Send color={C.ink} size={21} /><Text style={s.buttonDark}>Share Trip</Text></Pressable>
          <Pressable style={[s.actionButton, { backgroundColor: C.green }]} onPress={confirmArrival}><Check color="white" size={22} /><Text style={s.buttonWhite}>Arrive</Text></Pressable>
        </View>
      </View>
    </View>
  );
}

function FareCalculator({ open }: { open: (s: Screen) => void }) {
  const [distance, setDistance] = useState(6);
  const [special, setSpecial] = useState(false);
  const [sliderWidth, setSliderWidth] = useState(0);
  const setDistanceFromSlider = (x: number) => {
    if (!sliderWidth) return;
    const next = Math.max(.5, Math.min(12, (x / sliderWidth) * 12));
    setDistance(Math.round(next * 2) / 2);
  };
  const distanceSliderPan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: event => setDistanceFromSlider(event.nativeEvent.locationX),
    onPanResponderMove: event => setDistanceFromSlider(event.nativeEvent.locationX),
  }), [sliderWidth]);
  const regular = 20 + Math.max(0, distance - 4) * 2;
  const discount = special ? regular * .2 : 0;
  const total = regular - discount;
  return (
    <Page>
      <Header title="Fare Calculator" />
      <View style={s.transportBadge}><TricycleIcon size={18} /><Text style={s.badgeText}>Tricycle · Agoo, La Union</Text></View>
      <Card>
        <View style={s.rowBetween}><Text style={s.eyebrow}>DISTANCE (KM)</Text><Text style={s.bigValue}>{distance.toFixed(1)}</Text></View>
        <View
          {...distanceSliderPan.panHandlers}
          accessibilityRole="adjustable"
          accessibilityLabel="Trip distance"
          accessibilityValue={{ min: 1, max: 24, now: Math.round(distance * 2), text: `${distance.toFixed(1)} kilometers` }}
          onAccessibilityAction={({ nativeEvent }) => {
            if (nativeEvent.actionName === 'increment') setDistance(value => Math.min(12, value + .5));
            if (nativeEvent.actionName === 'decrement') setDistance(value => Math.max(.5, value - .5));
          }}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onLayout={({ nativeEvent }) => setSliderWidth(nativeEvent.layout.width)}
          style={s.sliderTrack}
        >
          <View style={s.sliderRail} />
          <View style={[s.sliderFill, { width: `${(distance / 12) * 100}%` }]} />
          <View style={[s.sliderThumb, { left: `${Math.min(95, (distance / 12) * 100)}%` }]} />
        </View>
        <View style={s.stepper}>
          <Pressable onPress={() => setDistance(Math.max(.5, distance - .5))} style={s.step}><Text style={s.stepText}>−</Text></Pressable>
          <Text style={s.caption}>Drag the green line to adjust</Text>
          <Pressable onPress={() => setDistance(Math.min(12, distance + .5))} style={s.step}><Text style={s.stepText}>+</Text></Pressable>
        </View>
      </Card>
      <Card style={s.rowBetween}><View><Text style={s.cardTitle}>Student / Senior / PWD</Text><Text style={s.caption}>Apply 20% legal discount</Text></View>
        <Switch value={special} onValueChange={setSpecial} trackColor={{ true: C.green }} /></Card>
      <View style={s.breakdown}>
        <Text style={s.cardTitle}>Fare Breakdown</Text>
        <Line label="Base fare (first 4 km)" value="₱20.00" />
        <Line label={`Succeeding ${Math.max(0, distance - 4).toFixed(1)} km × ₱2.00`} value={peso(Math.max(0, distance - 4) * 2)} />
        {special && <Line label="Discount (20%)" value={`−${peso(discount)}`} red />}
        <View style={s.divider} />
        <Text style={[s.eyebrow, { textAlign: 'center' }]}>ESTIMATED FARE</Text>
        <Text style={s.totalFare}>{peso(total)}</Text>
      </View>
      <Pressable style={s.secondaryButton} onPress={() => open('matrix')}><Text style={s.buttonDark}>View Full Fare Matrix</Text><ChevronRight size={20} /></Pressable>
    </Page>
  );
}

function FareMatrix({ goBack, satellite, tilt }: { goBack: () => void; satellite: boolean; tilt: boolean }) {
  const [query, setQuery] = useState('');
  const [matrixTab, setMatrixTab] = useState<'regular' | 'special' | 'zone'>('regular');
  const special = matrixTab === 'special';
  const data = useMemo(() => FARES.filter(x => x.barangay.toLowerCase().includes(query.toLowerCase())), [query]);
  return (
    <SafeAreaView style={s.page} edges={['top']}>
      <View style={{ paddingHorizontal: 20 }}><Header title="Fare Matrix" back={goBack} /></View>
      <View style={s.inlineSearch}><Search size={20} color={C.muted} /><TextInput value={query} onChangeText={setQuery} placeholder="Search barangay or route" style={s.input} /></View>
      <View style={s.segment}><Segment text="Regular" active={matrixTab === 'regular'} onPress={() => setMatrixTab('regular')} /><Segment text="Special" active={matrixTab === 'special'} onPress={() => setMatrixTab('special')} /><Segment text="Zone Map" active={matrixTab === 'zone'} onPress={() => setMatrixTab('zone')} /></View>
      <View style={[s.rowBetween, { paddingHorizontal: 20 }]}><Text style={s.cardTitle}>Agoo, La Union</Text><Badge text="✓ LGU Verified" /></View>
      {matrixTab === 'zone' ? <View style={s.zoneMapWrap}><MapView style={StyleSheet.absoluteFill} mapType={satellite ? 'hybrid' : 'standard'} showsTraffic showsCompass={false} userInterfaceStyle={darkModeActive ? 'dark' : 'light'} customMapStyle={darkModeActive ? DARK_MAP_STYLE : []} pitchEnabled rotateEnabled initialCamera={{ center: AGOO, pitch: tilt ? 50 : 0, heading: tilt ? 8 : 0, altitude: 8500, zoom: 11 }}>
        <MapCircle center={AGOO} radius={4000} fillColor="rgba(7,131,79,.24)" strokeColor="#27C27C" strokeWidth={2} />
        <MapCircle center={AGOO} radius={6500} fillColor="rgba(30,105,232,.12)" strokeColor="#4A9AFF" strokeWidth={2} />
        <Marker coordinate={AGOO} title="Agoo town proper"><View style={s.routeNode}><TricycleIcon color="white" size={21} /></View></Marker>
      </MapView><View style={s.zoneLegend}><Text style={s.zoneLegendTitle}>Fare zones</Text><Text style={s.zoneLegendText}>Green: first 4 km · ₱20 base fare</Text><Text style={s.zoneLegendText}>Blue: succeeding distance · +₱2/km</Text></View></View> : <>
      <View style={s.tableHeader}><Text style={[s.tableH, { flex: 2.7 }]}>BARANGAY / ROUTE</Text><Text style={[s.tableH, { flex: .65 }]}>KM</Text><Text style={[s.tableH, { flex: .75, textAlign: 'right' }]}>FARE</Text></View>
      <FlatList data={data} keyExtractor={x => x.barangay} contentContainerStyle={{ paddingBottom: 110 }}
        renderItem={({ item }) => <View style={s.tableRow}><Text style={s.tableName}>{item.barangay}</Text><Text style={s.tableCell}>{item.distance}</Text><Text style={s.tablePrice}>{peso(special ? item.special : item.regular)}</Text></View>}
        ListFooterComponent={<View style={s.source}><Check color={C.blue} size={18} /><Text style={[s.caption, { flex: 1 }]}>Source: Municipality of Agoo — Municipal Ordinance No. 14-2026. ₱20 base-fare bracket for gasoline at ₱101–₱110/L.</Text></View>} />
      </>}
    </SafeAreaView>
  );
}

function TerminalsScreen({ goBack, directions, satellite, tilt }: { goBack: () => void; directions: () => void; satellite: boolean; tilt: boolean }) {
  return (
    <View style={s.flex}>
      <SafeAreaView style={s.pageTop} edges={['top']}><Header title="Nearby Terminals" back={goBack} /></SafeAreaView>
      <View style={{ height: 245 }}><AppMap satellite={satellite} tilt={tilt} traffic /></View>
      <ScrollView style={s.terminalList} contentContainerStyle={{ paddingBottom: 115 }}>
        <View style={s.rowBetween}><Text style={s.eyebrow}>NEARBY TERMINAL</Text><Badge text="Live map" /></View>
        {TERMINALS.slice(0, 1).map(t => <Card key={t.name}>
          <View style={s.row}><View style={s.iconTile}><MapPinned color={C.green} size={23} /></View><View style={s.grow}><Text style={s.cardTitle}>{t.name}</Text><Text style={s.caption}>{t.distance} • Tricycle</Text><Badge text={`◷ ${t.open}`} /></View></View>
          <Pressable style={[s.primaryButton, { marginTop: 14 }]} onPress={directions}><Text style={s.buttonWhite}>Get Directions in App</Text></Pressable>
        </Card>)}
      </ScrollView>
    </View>
  );
}

function HistoryScreen({ rides }: { rides: SavedTrip[] }) {
  return <Page><Header title="Ride History" right={<IconButton icon={<Search size={20} color={darkModeActive ? C.white : C.ink} />} onPress={() => Alert.alert('Search rides', 'Use the destination search on Home to repeat or plan a ride.')} />} />
    {!rides.length && <Card><View style={s.about}><History color={C.green} size={30} /><Text style={s.cardTitle}>No completed rides yet</Text><Text style={s.caption}>Trips appear here after Arrive is confirmed near your destination.</Text></View></Card>}
    {rides.map((r, i) => <View key={r.id} style={s.historyItem}><Text style={s.historyLabel}>{i === 0 ? 'LATEST' : 'PREVIOUS'}</Text><Card>
      <View style={s.row}><View style={s.iconTile}><TricycleIcon /></View><View style={s.grow}><Text style={s.cardTitle}>Current location → {r.destination}</Text><Text style={s.caption}>{new Date(r.completedAt).toLocaleString()} • {r.distanceKm.toFixed(2)} km</Text></View><Text style={s.price}>{peso(r.fare)}</Text></View>
      {r.feedbackStatus === 'no_problem' && <View style={[s.historyFeedbackBadge, s.historyFeedbackOk]}><Check size={14} color={C.green} /><Text style={s.historyFeedbackOkText}>No problem</Text></View>}
      {r.feedbackStatus === 'reported' && <View style={[s.historyFeedbackBadge, s.historyFeedbackReported]}><Flag size={14} color={C.red} /><Text style={s.historyFeedbackReportedText}>Reported</Text></View>}
    </Card></View>)}
  </Page>;
}

function ReportScreen({ goBack, postTrip, trip, noProblem, markReported, profile }: { goBack: () => void; postTrip: boolean; trip: SavedTrip | null; noProblem: () => void; markReported: () => void; profile: UserProfile }) {
  const [issue, setIssue] = useState('Incorrect Fare');
  const [details, setDetails] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const choosePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert('Photos permission needed', 'Allow photo access to attach evidence.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: .8, allowsEditing: true });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  };
  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) { Alert.alert('Camera permission needed', 'Allow camera access to take evidence photos.'); return; }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: .8, allowsEditing: true });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  };
  const submitReport = async () => {
    if (submitting) return;
    if (!details.trim() && !photoUri) {
      Alert.alert('Add report information', 'Describe what happened or attach a photo before sending your report.');
      return;
    }
    setSubmitting(true);
    try {
      let location: Location.LocationObject | null = null;
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status === 'granted') location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const record: PendingAdminRecord = { clientId: `report-${Date.now()}`, fields: {
        issue, details: details.trim(), reporterName: profile.name, reporterEmail: profile.email,
        destination: trip?.destination ?? 'Current ride in Agoo', distanceKm: trip?.distanceKm.toFixed(2) ?? '', fare: trip ? String(trip.fare) : '',
        latitude: location ? String(location.coords.latitude) : '', longitude: location ? String(location.coords.longitude) : '',
      }, ...(photoUri ? { photoUri } : {}) };
      try {
        await sendAdminRecord('/api/reports', record);
        if (postTrip) markReported();
        Alert.alert('Report submitted', 'Your report was sent to the Tri Fare Agoo admin dashboard.', [{ text: 'Done', onPress: goBack }]);
      } catch {
        await queueAdminRecord(PENDING_REPORTS_KEY, record);
        if (postTrip) markReported();
        Alert.alert('Report saved', 'The admin server is offline. Your complete report is queued and will sync automatically.', [{ text: 'Done', onPress: goBack }]);
      }
      setDetails(''); setPhotoUri(null);
    } catch {
      Alert.alert('Could not save report', 'Please try again.');
    } finally { setSubmitting(false); }
  };
  return <Page keyboard><Header title="Report / Feedback" back={goBack} />
    {postTrip && <View style={s.arrivalBanner}><View style={s.arrivalCheck}><Check color="white" size={22} /></View><View style={s.grow}><Text style={s.cardTitle}>Trip saved to history</Text><Text style={s.caption}>Was everything okay with your ride?</Text></View></View>}
    {postTrip && trip && <Card>
      <Text style={s.eyebrow}>COMPLETED TRIP</Text>
      <View style={s.rowBetween}><Text style={s.cardTitle}>{trip.destination}</Text><Text style={s.price}>{peso(trip.fare)}</Text></View>
      <Text style={s.caption}>{trip.distanceKm.toFixed(2)} km travelled by GPS</Text>
      <Text style={s.caption}>Final fare recalculated from the driven distance using the Agoo fare rule.</Text>
    </Card>}
    <Text style={s.eyebrow}>WHAT'S THE ISSUE?</Text>
    <View style={s.wrap}>{['Incorrect Fare', 'Rude Driver', 'Wrong Route Info', 'Other'].map(x =>
      <Pressable key={x} onPress={() => setIssue(x)} style={[s.issueChip, issue === x && s.issueActive]}><Text style={[s.issueText, issue === x && { color: 'white' }]}>{x}</Text></Pressable>)}</View>
    <Text style={s.eyebrow}>ADD A PHOTO</Text>
    {photoUri ? <View style={s.photoPreviewWrap}><Image source={{ uri: photoUri }} style={s.photoPreview} /><Pressable style={s.removePhoto} onPress={() => setPhotoUri(null)}><X color="white" size={18} /></Pressable></View>
      : <View style={s.photoActions}>
        <Pressable style={s.photoAction} onPress={takePhoto}><Camera color={C.blue} size={25} /><Text style={s.cardTitle}>Camera</Text></Pressable>
        <Pressable style={s.photoAction} onPress={choosePhoto}><Upload color={C.blue} size={25} /><Text style={s.cardTitle}>Photos</Text></Pressable>
      </View>}
    <Text style={s.eyebrow}>DETAILS</Text>
    <TextInput multiline value={details} onChangeText={setDetails} placeholder="Describe what happened..." placeholderTextColor={darkModeActive ? '#A5B0A8' : '#718078'} style={s.textarea} />
    <Pressable style={[s.primaryButton, submitting && { opacity: .6 }]} disabled={submitting} onPress={submitReport}>{submitting ? <ActivityIndicator color="white" /> : <><Flag color="white" size={19} /><Text style={s.buttonWhite}>Report It</Text></>}</Pressable>
    {postTrip && <Pressable style={s.noProblemButton} onPress={noProblem}><Check color={C.green} size={20} /><Text style={s.noProblemText}>No problem with this ride</Text></Pressable>}
  </Page>;
}

function ProfileScreen({ open, profile, logout, theme, setTheme }: { open: (s: Screen) => void; profile: UserProfile; logout: () => void; theme: ThemeMode; setTheme: (theme: ThemeMode) => void }) {
  return <Page><Header title="Profile" /><View style={s.profile}><Image source={{ uri: profile.photoUri }} style={s.profilePhoto} /><View style={s.grow}><Text style={s.cardTitle}>{profile.name}</Text><Text style={s.caption}>{profile.email || 'Add email by creating a new account'}</Text><Text style={s.caption}>{profile.role} · Agoo, La Union</Text></View></View>
    <Card style={s.appearanceCard}><View style={s.row}><View style={s.appearanceIcon}>{theme === 'dark' ? <Moon color="#7EDCAA" size={22} /> : <Sun color="#E5A51D" size={22} />}</View><View style={s.grow}><Text style={s.cardTitle}>Appearance</Text><Text style={s.caption}>{theme === 'dark' ? 'Dark mode' : 'Light mode'}</Text></View><Switch value={theme === 'dark'} onValueChange={enabled => setTheme(enabled ? 'dark' : 'light')} trackColor={{ false: '#CBD5CE', true: C.green }} /></View></Card>
    <Card><MenuRow icon={<SlidersHorizontal color={C.green} />} title="Fare Matrix" onPress={() => open('matrix')} /><MenuRow icon={<MessageSquareWarning color={C.red} />} title="Report / Feedback" onPress={() => open('report')} /><MenuRow icon={<ShieldCheck color={C.blue} />} title="Agoo emergency hotlines" onPress={showAgooEmergencyHotlines} /></Card>
    <Pressable style={s.logoutButton} onPress={logout}><Text style={s.logoutText}>Log out</Text></Pressable>
    <View style={s.about}><TricycleIcon size={36} /><Text style={s.brand}>Tri Fare Agoo</Text><Text style={s.caption}>Fair rides. Clear fares. Safer journeys.</Text><Pressable accessibilityRole="link" onPress={() => Linking.openURL(DEVELOPER_PORTFOLIO)}><Text style={s.developerCredit}>Developer: <Text style={s.developerName}>Jasmine Barnachea</Text></Text></Pressable><Text style={s.version}>Version 1.0.0</Text></View>
  </Page>;
}

function BottomNav({ active, set, profile, theme }: { active: Tab; set: (t: Tab) => void; profile: UserProfile; theme: ThemeMode }) {
  const items: [Tab, string, React.ReactNode][] = [
    ['home', 'Home', <Home size={22} />], ['fare', 'Rate', <Calculator size={22} />],
    ['history', 'History', <History size={22} />], ['profile', 'Profile', <Image source={{ uri: profile.photoUri }} style={s.navProfilePhoto} />],
  ];
  return <BlurView intensity={70} tint={theme === 'dark' ? 'dark' : 'light'} experimentalBlurMethod="dimezisBlurView" style={s.nav}>{items.map(([key, label, icon]) =>
    <Pressable accessibilityLabel={label} key={key} style={[s.navItem, active === key && s.navActive]} onPress={() => set(key)}>
      {key === 'profile' ? <View style={[s.navProfileWrap, active === key && s.navProfileActive]}>{icon}</View> : React.cloneElement(icon as React.ReactElement<any>, { color: active === key ? C.white : darkModeActive ? '#C5CEC8' : '#536159', strokeWidth: active === key ? 2.7 : 2 })}
    </Pressable>)}</BlurView>;
}

function Page({ children, keyboard }: { children: React.ReactNode; keyboard?: boolean }) {
  const content = <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.pageContent} showsVerticalScrollIndicator={false}>{children}</ScrollView>;
  return <SafeAreaView style={s.page} edges={['top']}>{keyboard ? <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>{content}</KeyboardAvoidingView> : content}</SafeAreaView>;
}
function Header({ title, back, right }: { title: string; back?: () => void; right?: React.ReactNode }) {
  return <View style={s.header}>{back && <IconButton icon={<ArrowLeft size={22} color={darkModeActive ? C.white : C.ink} />} onPress={back} />}<Text style={s.headerTitle}>{title}</Text><View style={{ marginLeft: 'auto' }}>{right}</View></View>;
}
function Card({ children, style }: { children: React.ReactNode; style?: any }) { return <View style={[s.card, style]}>{children}</View>; }
function IconButton({ icon, onPress }: { icon: React.ReactNode; onPress?: () => void }) { return <Pressable onPress={onPress} style={s.iconButton}>{icon}</Pressable>; }
function Pill({ text, icon, active, onPress }: { text: string; icon: React.ReactNode; active?: boolean; onPress?: () => void }) { return <Pressable onPress={onPress} style={[s.pill, active && s.pillActive]}>{icon}<Text style={[s.pillText, active && { color: 'white' }]}>{text}</Text></Pressable>; }
function Tool({ icon, label, onPress }: { icon?: React.ReactNode; label?: string; onPress?: () => void }) { return <Pressable onPress={onPress} style={s.tool}>{icon}{label && <Text style={s.bold}>{label}</Text>}</Pressable>; }
function Quick({ icon, title, onPress }: { icon: React.ReactNode; title: string; onPress: () => void }) { return <Pressable style={s.quick} onPress={onPress}><View style={s.iconTile}>{icon}</View><Text style={s.quickTitle}>{title}</Text></Pressable>; }
function PrimaryButton({ text, onPress }: { text: string; onPress: () => void }) { return <Pressable style={s.primaryButton} onPress={onPress}><Text style={s.buttonWhite}>{text}</Text><ArrowRight color="white" size={18} /></Pressable>; }
function Badge({ text }: { text: string }) { return <View style={s.badge}><Text style={s.badgeText}>{text}</Text></View>; }
function Line({ label, value, strong, red }: { label: string; value: string; strong?: boolean; red?: boolean }) { return <View style={s.line}><Text style={[s.lineLabel, strong && s.bold]}>{label}</Text><Text style={[s.lineValue, strong && s.price, red && { color: C.red }]}>{value}</Text></View>; }
function Stat({ label, value, green }: { label: string; value: string; green?: boolean }) { return <View style={s.stat}><Text style={s.eyebrow}>{label}</Text><Text style={[s.statValue, green && { color: C.green }]}>{value}</Text></View>; }
function Segment({ text, active, onPress }: { text: string; active?: boolean; onPress?: () => void }) { return <Pressable onPress={onPress} style={[s.segmentItem, active && s.segmentActive]}><Text style={[s.segmentText, active && { color: C.green }]}>{text}</Text></Pressable>; }
function MenuRow({ icon, title, onPress }: { icon: React.ReactNode; title: string; onPress?: () => void }) { return <Pressable style={s.menuRow} onPress={onPress}>{icon}<Text style={[s.cardTitle, s.grow]}>{title}</Text><ChevronRight color={C.muted} size={20} /></Pressable>; }
const baseStyles = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.pale }, flex: { flex: 1 }, grow: { flex: 1 }, row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  onboardingPage: { flex: 1 },
  onboardingSafe: { flex: 1, paddingHorizontal: 25, paddingTop: 12, paddingBottom: 24, justifyContent: 'space-between' },
  onboardingSafeCompact: { paddingTop: 5, paddingBottom: 12 },
  onboardingBrand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  onboardingBrandIcon: { width: 47, height: 47, borderRadius: 16, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' },
  onboardingBrandText: { fontFamily: 'Manrope_800ExtraBold', color: C.white, fontSize: 12, letterSpacing: 1.5 },
  onboardingHero: { minHeight: 430, justifyContent: 'center' },
  onboardingHeroCompact: { minHeight: 350 },
  onboardingGlow: { position: 'absolute', width: 330, height: 330, borderRadius: 165, backgroundColor: 'rgba(255,255,255,.08)', right: -120, top: -50 },
  onboardingKicker: { fontFamily: 'Manrope_800ExtraBold', color: '#9DE6BF', fontSize: 10, letterSpacing: 1.8 },
  onboardingTitle: { fontFamily: 'Manrope_800ExtraBold', color: C.white, fontSize: 41, lineHeight: 48, marginTop: 12, maxWidth: 330 },
  onboardingTitleCompact: { fontSize: 34, lineHeight: 39, marginTop: 8 },
  onboardingSubtitle: { fontFamily: 'Manrope_500Medium', color: '#D1E9DC', fontSize: 14, lineHeight: 22, marginTop: 15, maxWidth: 325 },
  onboardingRoad: { height: 104, borderRadius: 30, backgroundColor: 'rgba(3,37,24,.45)', marginTop: 35, justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,.13)' },
  onboardingRoadCompact: { height: 82, marginTop: 18, borderRadius: 24 },
  onboardingRoadLine: { position: 'absolute', left: 20, right: 20, height: 2, backgroundColor: 'rgba(255,255,255,.3)' },
  onboardingTricycle: { width: 64, height: 64, borderRadius: 22, backgroundColor: C.green, borderWidth: 2, borderColor: 'rgba(255,255,255,.8)', alignItems: 'center', justifyContent: 'center' },
  onboardingButton: { height: 62, borderRadius: 21, backgroundColor: C.white, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  onboardingButtonText: { fontFamily: 'Manrope_800ExtraBold', color: C.green, fontSize: 15 },
  onboardingFooter: { gap: 14 },
  onboardingDeveloper: { fontFamily: 'Manrope_500Medium', color: '#CBE6D7', fontSize: 10, textAlign: 'center' },
  onboardingDeveloperName: { fontFamily: 'Manrope_800ExtraBold', color: C.white, textDecorationLine: 'underline' },
  authPage: { flex: 1, backgroundColor: '#0D1711', overflow: 'hidden' },
  authGlow: { position: 'absolute', width: 380, height: 380, borderRadius: 190, backgroundColor: '#0B7549', opacity: .28, top: -170, right: -140 },
  authSafe: { flex: 1 },
  authScroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 42, paddingBottom: 22, justifyContent: 'space-between', gap: 24 },
  authKicker: { fontFamily: 'Manrope_800ExtraBold', color: '#62D89B', fontSize: 11, letterSpacing: 2 },
  authTitle: { fontFamily: 'Manrope_800ExtraBold', color: C.white, fontSize: 38, lineHeight: 44, marginTop: 8 },
  authSubtitle: { fontFamily: 'Manrope_500Medium', color: '#9AA99F', fontSize: 13, lineHeight: 20, marginTop: 8, maxWidth: 310 },
  authCard: { borderRadius: 30, padding: 18, gap: 12, backgroundColor: 'rgba(24,31,26,.98)', borderWidth: 1, borderColor: '#303B33' },
  authPhoto: { width: 78, height: 78, borderRadius: 25, alignSelf: 'center', backgroundColor: '#26362C', borderWidth: 1, borderColor: '#3A5948', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  authPhotoImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  authPhotoText: { fontFamily: 'Manrope_700Bold', color: '#8FE2B5', fontSize: 9, marginTop: 3 },
  authInput: { height: 54, borderRadius: 17, backgroundColor: '#303832', color: C.white, paddingHorizontal: 15, fontFamily: 'Manrope_600SemiBold', borderWidth: 1, borderColor: '#414B44' },
  authPasswordRow: { height: 54, borderRadius: 17, backgroundColor: '#303832', paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#414B44' },
  authPasswordInput: { flex: 1, color: C.white, fontFamily: 'Manrope_600SemiBold' },
  authRoleRow: { flexDirection: 'row', gap: 9 },
  authRole: { flex: 1, height: 44, borderRadius: 15, backgroundColor: '#303832', alignItems: 'center', justifyContent: 'center' },
  authRoleActive: { backgroundColor: C.green },
  authRoleText: { fontFamily: 'Manrope_700Bold', color: '#AAB4AD', fontSize: 11 },
  authSubmit: { height: 55, borderRadius: 18, backgroundColor: C.green, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  authSwitch: { fontFamily: 'Manrope_700Bold', color: '#6DDB9F', fontSize: 11, textAlign: 'center', paddingVertical: 5 },
  authPrivacy: { fontFamily: 'Manrope_500Medium', color: '#667269', fontSize: 9, textAlign: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  page: { flex: 1, backgroundColor: C.pale }, pageTop: { backgroundColor: C.pale, paddingHorizontal: 16 }, pageContent: { padding: 20, paddingBottom: 120, gap: 14 },
  header: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  headerTitle: { fontFamily: 'Manrope_800ExtraBold', color: C.ink, fontSize: 21 },
  iconButton: { width: 44, height: 44, backgroundColor: C.white, borderRadius: 14, alignItems: 'center', justifyContent: 'center', shadowColor: '#10291D', shadowOpacity: .08, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } },
  mapArea: { ...StyleSheet.absoluteFillObject }, homeOverlay: { ...StyleSheet.absoluteFillObject, paddingHorizontal: 20, pointerEvents: 'box-none' },
  searchBar: { height: 58, backgroundColor: 'rgba(255,255,255,.95)', borderRadius: 19, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 17, marginTop: 12, gap: 12, shadowColor: '#123', shadowOpacity: .14, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  searchPlaceholder: { flex: 1, fontFamily: 'Manrope_600SemiBold', color: C.muted }, voice: { backgroundColor: C.mint, borderRadius: 12, padding: 8 },
  chips: { flexDirection: 'row', gap: 10, marginTop: 14 }, pill: { backgroundColor: 'rgba(255,255,255,.95)', borderRadius: 22, paddingHorizontal: 15, height: 42, flexDirection: 'row', gap: 7, alignItems: 'center' },
  pillActive: { backgroundColor: C.green }, pillText: { fontFamily: 'Manrope_700Bold', color: C.ink, fontSize: 13 },
  mapTools: { position: 'absolute', right: 20, top: 104, gap: 8 }, tool: { width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(255,255,255,.96)', alignItems: 'center', justifyContent: 'center' },
  mapPin: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'white' },
  homeSheet: { position: 'absolute', left: 14, right: 14, top: 58, backgroundColor: 'rgba(18,21,18,.97)', borderRadius: 23, borderWidth: 1, borderColor: 'rgba(255,255,255,.12)', padding: 10 },
  homeDiscoverPanel: { position: 'absolute', left: 12, right: 12, top: 50, backgroundColor: 'rgba(18,21,18,.96)', borderRadius: 25, borderWidth: 1, borderColor: 'rgba(255,255,255,.12)', padding: 13, shadowColor: '#000', shadowOpacity: .28, shadowRadius: 18 },
  homeExploreHeading: { paddingTop: 4 },
  mapAttribution: { fontFamily: 'Manrope_600SemiBold', color: '#67726B', fontSize: 7, marginTop: 3 },
  routeAttribution: { position: 'absolute', top: 112, left: 18, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(255,255,255,.82)' },
  rideAttribution: { position: 'absolute', top: 146, left: 18, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(255,255,255,.82)' },
  homeSheetViewport: { ...StyleSheet.absoluteFillObject, bottom: 90, overflow: 'hidden', borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
  homeExploreSheet: { position: 'absolute', left: 12, right: 12, bottom: 12, borderRadius: 29, padding: 17, backgroundColor: 'rgba(20,23,20,.97)', borderWidth: 1, borderColor: 'rgba(255,255,255,.12)', shadowColor: '#000', shadowOpacity: .5, shadowRadius: 24 },
  homeExploreSheetFocused: { paddingTop: 13, paddingBottom: 13 },
  homeDiscoverKicker: { fontFamily: 'Manrope_800ExtraBold', color: '#84B69A', fontSize: 9, letterSpacing: 1.4 },
  homeDiscoverTitle: { fontFamily: 'Manrope_800ExtraBold', color: C.white, fontSize: 20, marginTop: 1, marginBottom: 9 },
  homePlacesRow: { gap: 8, paddingTop: 10, paddingRight: 4 },
  homePlaceSquare: { width: 74, minHeight: 76, borderRadius: 16, backgroundColor: '#252925', borderWidth: 1, borderColor: '#343A35', padding: 6 },
  homePlaceSquareActive: { borderColor: C.green, backgroundColor: '#173528' },
  homePlaceIcon: { height: 39, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  homePlaceName: { fontFamily: 'Manrope_700Bold', color: C.white, fontSize: 8, lineHeight: 11, marginTop: 5 },
  dragHandleArea: { height: 34, marginHorizontal: -8, marginTop: -8, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 52, height: 5, borderRadius: 3, backgroundColor: '#89918B', alignSelf: 'center' },
  locationRow: { flexDirection: 'row', gap: 10, alignItems: 'center' }, locationTitle: { fontFamily: 'Manrope_800ExtraBold', fontSize: 15, color: C.white },
  homeWhereTo: { height: 60, borderRadius: 19, backgroundColor: '#343936', borderWidth: 1, borderColor: '#464C47', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 11, marginTop: 14 },
  exploreGoButton: { height: 48, borderRadius: 16, backgroundColor: C.green, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 2, paddingHorizontal: 14 },
  homeWhereTitle: { fontFamily: 'Manrope_800ExtraBold', color: C.white, fontSize: 14 },
  homeWhereLocation: { fontFamily: 'Manrope_500Medium', color: '#98A19A', fontSize: 9, marginTop: 2 },
  homeGoCircle: { width: 37, height: 37, borderRadius: 19, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  caption: { fontFamily: 'Manrope_400Regular', fontSize: 12, color: C.muted }, quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 15 },
  quick: { width: '48.5%', minHeight: 68, backgroundColor: '#242824', borderRadius: 18, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderColor: '#303630' },
  iconTile: { width: 45, height: 45, borderRadius: 14, backgroundColor: C.mint, alignItems: 'center', justifyContent: 'center' },
  quickTitle: { flex: 1, fontFamily: 'Manrope_700Bold', color: C.white, fontSize: 13 },
  swipeHint: { fontFamily: 'Manrope_600SemiBold', color: '#6F7972', fontSize: 9, textAlign: 'center', marginTop: 10 },
  nav: { position: 'absolute', bottom: 24, left: 24, right: 24, height: 66, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,.28)', paddingHorizontal: 7, borderWidth: 1.2, borderColor: 'rgba(255,255,255,.72)', borderRadius: 34, shadowColor: '#071B10', shadowOpacity: .22, shadowRadius: 22, shadowOffset: { width: 0, height: 9 }, overflow: 'hidden' },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 27, height: 52 }, navActive: { backgroundColor: C.green },
  navProfileWrap: { width: 31, height: 31, borderRadius: 16, padding: 2, backgroundColor: 'rgba(255,255,255,.48)' },
  navProfileActive: { backgroundColor: C.white },
  navProfilePhoto: { width: '100%', height: '100%', borderRadius: 14, resizeMode: 'cover' },
  navText: { fontFamily: 'Manrope_600SemiBold', fontSize: 10, color: '#707A73' },
  card: { backgroundColor: C.white, borderRadius: 22, padding: 16, gap: 10, shadowColor: '#183226', shadowOpacity: .07, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  cardTitle: { fontFamily: 'Manrope_700Bold', color: C.ink, fontSize: 14 }, bigValue: { fontFamily: 'Manrope_800ExtraBold', color: C.ink, fontSize: 20 },
  eyebrow: { fontFamily: 'Manrope_800ExtraBold', color: C.muted, fontSize: 10, letterSpacing: .8, marginTop: 7 },
  sliderTrack: { height: 36, justifyContent: 'center', marginVertical: 2 },
  sliderRail: { position: 'absolute', left: 0, right: 0, height: 8, borderRadius: 4, backgroundColor: C.line },
  sliderFill: { height: 8, borderRadius: 4, backgroundColor: C.green },
  sliderThumb: { position: 'absolute', top: 9, width: 18, height: 18, borderRadius: 9, backgroundColor: C.green, marginLeft: -8 },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, step: { width: 36, height: 32, borderRadius: 10, backgroundColor: C.mint, alignItems: 'center', justifyContent: 'center' }, stepText: { fontFamily: 'Manrope_800ExtraBold', fontSize: 20, color: C.green },
  breakdown: { backgroundColor: C.mint, borderRadius: 24, padding: 19, gap: 5, borderWidth: 1, borderStyle: 'dashed', borderColor: '#CDE3D7' },
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, gap: 10 }, lineLabel: { flex: 1, fontFamily: 'Manrope_400Regular', color: C.muted, fontSize: 13 }, lineValue: { fontFamily: 'Manrope_700Bold', color: C.ink, fontSize: 13 },
  divider: { height: 1, backgroundColor: C.line, marginVertical: 5 }, totalFare: { textAlign: 'center', fontFamily: 'Manrope_800ExtraBold', color: C.green, fontSize: 38 },
  primaryButton: { height: 56, borderRadius: 17, backgroundColor: C.green, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  secondaryButton: { height: 56, borderRadius: 17, backgroundColor: C.mint, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  buttonWhite: { color: 'white', fontFamily: 'Manrope_800ExtraBold', fontSize: 14 }, buttonDark: { color: C.ink, fontFamily: 'Manrope_800ExtraBold', fontSize: 13 },
  bold: { fontFamily: 'Manrope_700Bold', color: C.ink }, badge: { alignSelf: 'flex-start', backgroundColor: C.mint, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 14 },
  transportBadge: { alignSelf: 'flex-start', backgroundColor: C.mint, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 7 },
  badgeText: { fontFamily: 'Manrope_700Bold', color: C.green, fontSize: 11 }, routeSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, top: '28%', backgroundColor: C.pale, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20 },
  floatingBack: { position: 'absolute', top: 0, left: 18 }, routeInputs: { backgroundColor: C.white, borderRadius: 20, padding: 15, display: 'flex', gap: 9 },
  dot: { width: 9, height: 9, borderRadius: 5, position: 'absolute', left: 15 }, routeText: { fontFamily: 'Manrope_600SemiBold', marginLeft: 20, color: C.ink, fontSize: 13 },
  routeTopSafe: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 16 },
  routeTopRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  routeBackButton: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(24,29,25,.9)', borderWidth: 1, borderColor: 'rgba(255,255,255,.18)', shadowColor: '#000', shadowOpacity: .2, shadowRadius: 10 },
  routeSearch: { flex: 1, height: 52, borderRadius: 17, backgroundColor: 'rgba(57,62,59,.98)', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 9, borderWidth: 1, borderColor: '#4A504B' },
  routeInput: { flex: 1, fontFamily: 'Manrope_600SemiBold', color: C.white, fontSize: 14 },
  searchResults: { marginTop: 8, marginLeft: 54, maxHeight: 360, borderRadius: 18, overflow: 'hidden', backgroundColor: 'rgba(27,30,28,.99)', shadowColor: '#000', shadowOpacity: .35, shadowRadius: 16, borderWidth: 1, borderColor: '#3A403B' },
  searchResult: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 13, borderBottomWidth: 1, borderColor: '#383D39' },
  searchResultTitle: { fontFamily: 'Manrope_700Bold', color: C.white, fontSize: 13 },
  searchResultCaption: { fontFamily: 'Manrope_500Medium', color: '#9AA39C', fontSize: 10 },
  pinLocationButton: { position: 'absolute', top: 118, right: 16, width: 45, height: 45, borderRadius: 16, backgroundColor: 'rgba(255,255,255,.96)', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: .22, shadowRadius: 12 },
  pinLocationButtonActive: { backgroundColor: C.blue },
  pinLocationText: { fontFamily: 'Manrope_800ExtraBold', color: C.ink, fontSize: 11 },
  panoRouteCard: { position: 'absolute', left: 10, right: 10, bottom: 10, height: '49%', borderRadius: 28, padding: 14, backgroundColor: 'rgba(18,21,18,.98)', borderWidth: 1, borderColor: 'rgba(255,255,255,.13)' },
  routeCardScroll: { flex: 1 },
  routeCardContent: { paddingBottom: 42 },
  routeNode: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.blue, borderWidth: 3, borderColor: 'white', alignItems: 'center', justifyContent: 'center' },
  navigationArrowWrap: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center' },
  navigationArrowPulse: { position: 'absolute', width: 48, height: 48, borderRadius: 24, backgroundColor: '#5BBBEF' },
  navigationArrow: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#39A9E8', borderWidth: 3, borderColor: C.white, alignItems: 'center', justifyContent: 'center', shadowColor: '#092C40', shadowOpacity: .45, shadowRadius: 7, shadowOffset: { width: 0, height: 4 } },
  currentLocationMarker: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(57,169,232,.28)', borderWidth: 2, borderColor: C.white, alignItems: 'center', justifyContent: 'center', shadowColor: '#092C40', shadowOpacity: .4, shadowRadius: 7 },
  currentLocationDot: { width: 17, height: 17, borderRadius: 9, backgroundColor: '#159BE5', borderWidth: 2, borderColor: C.white },
  pulseWrap: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center' },
  pinPulse: { position: 'absolute', width: 42, height: 42, borderRadius: 21, backgroundColor: '#36A2FF' },
  wazePin: { width: 39, height: 39, borderRadius: 20, backgroundColor: C.blue, borderWidth: 3, borderColor: 'white', alignItems: 'center', justifyContent: 'center', shadowColor: '#36A2FF', shadowOpacity: .9, shadowRadius: 10 },
  pinnedMapIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.blue, borderWidth: 3, borderColor: C.white, alignItems: 'center', justifyContent: 'center', shadowColor: C.blue, shadowOpacity: .8, shadowRadius: 9 },
  privateLocationMarker: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(30,105,232,.2)', borderWidth: 2, borderColor: C.white, alignItems: 'center', justifyContent: 'center' },
  privateLocationDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: C.blue },
  routeMetrics: { flexDirection: 'row', backgroundColor: '#232723', borderRadius: 17, paddingVertical: 12, marginTop: 13 },
  routeChoices: { gap: 8, paddingVertical: 9 },
  routeChoice: { minWidth: 120, borderRadius: 14, paddingHorizontal: 11, paddingVertical: 8, backgroundColor: '#292E2A', borderWidth: 1, borderColor: '#3A413B' },
  routeChoiceActive: { backgroundColor: '#143D2B', borderColor: C.green },
  routeChoiceTitle: { fontFamily: 'Manrope_800ExtraBold', color: C.white, fontSize: 10 },
  routeChoiceMeta: { fontFamily: 'Manrope_600SemiBold', color: '#9EA79F', fontSize: 9, marginTop: 2 },
  matrixFareBox: { borderRadius: 17, backgroundColor: '#232723', padding: 12, gap: 6, marginTop: 9, borderWidth: 1, borderColor: '#313731' },
  matrixFareTitle: { fontFamily: 'Manrope_800ExtraBold', color: C.white, fontSize: 12 },
  matrixFareSource: { fontFamily: 'Manrope_500Medium', color: '#8F9991', fontSize: 9, maxWidth: 205 },
  matrixFareTotal: { fontFamily: 'Manrope_800ExtraBold', color: '#3ACB80', fontSize: 24 },
  matrixDivider: { height: 1, backgroundColor: '#353B36', marginVertical: 2 },
  matrixSmall: { fontFamily: 'Manrope_500Medium', color: '#AEB6B0', fontSize: 10 },
  matrixValue: { fontFamily: 'Manrope_800ExtraBold', color: C.white, fontSize: 11 },
  specialRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#EEF5F0', borderRadius: 16, padding: 11, marginTop: 10 },
  routeNotice: { fontFamily: 'Manrope_500Medium', color: '#8E9991', fontSize: 10, lineHeight: 15, marginVertical: 9 },
  openMapsButton: { height: 54, minWidth: 116, borderRadius: 17, backgroundColor: '#EAF3EC', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  startRideButton: { width: '100%', height: 54, borderRadius: 17, backgroundColor: C.green, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  pinHint: { fontFamily: 'Manrope_600SemiBold', color: '#7F8981', fontSize: 9, textAlign: 'center', marginTop: 8 },
  rideCard: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: C.green, borderRadius: 20, padding: 14, gap: 12, backgroundColor: C.white },
  price: { fontFamily: 'Manrope_800ExtraBold', color: C.green, fontSize: 18 }, estimate: { backgroundColor: C.mint, borderRadius: 20, padding: 15, marginBottom: 12 },
  rideStats: { position: 'absolute', top: 0, left: 16, right: 16 }, statsCard: { flexDirection: 'row', marginTop: 56, backgroundColor: 'rgba(255,255,255,.96)', borderRadius: 22, padding: 14 },
  stat: { flex: 1, alignItems: 'center', borderRightWidth: 1, borderColor: C.line }, statValue: { fontFamily: 'Manrope_800ExtraBold', fontSize: 17, color: C.ink },
  rideSheet: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 18, backgroundColor: C.white, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  destinationMarker: { width: 39, height: 39, borderRadius: 20, backgroundColor: C.red, borderWidth: 3, borderColor: 'white', alignItems: 'center', justifyContent: 'center' },
  liveDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: C.green, shadowColor: C.green, shadowOpacity: .8, shadowRadius: 7 },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: C.line, marginVertical: 12, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: C.blue },
  liveShare: { backgroundColor: C.mint, borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 12 },
  actionButton: { flex: 1, height: 68, borderRadius: 18, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center' },
  inlineSearch: { height: 54, marginHorizontal: 20, backgroundColor: C.white, borderRadius: 17, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { flex: 1, fontFamily: 'Manrope_500Medium', color: C.ink }, segment: { flexDirection: 'row', backgroundColor: C.mint, borderRadius: 15, padding: 4, margin: 14 },
  segmentItem: { flex: 1, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12 }, segmentActive: { backgroundColor: C.white },
  segmentText: { fontFamily: 'Manrope_700Bold', color: C.muted, fontSize: 12 }, tableHeader: { flexDirection: 'row', backgroundColor: C.mint, padding: 12, marginTop: 12 },
  tableH: { flex: 1, fontFamily: 'Manrope_800ExtraBold', color: C.muted, fontSize: 9 }, tableRow: { flexDirection: 'row', alignItems: 'center', minHeight: 54, paddingHorizontal: 12, borderBottomWidth: 1, borderColor: C.line, backgroundColor: C.white },
  tableName: { flex: 2.7, fontFamily: 'Manrope_600SemiBold', color: C.ink, fontSize: 10 }, tableCell: { flex: .65, fontFamily: 'Manrope_500Medium', color: C.muted, fontSize: 10 }, tablePrice: { flex: .75, fontFamily: 'Manrope_800ExtraBold', color: C.ink, fontSize: 13, textAlign: 'right' },
  zoneMapWrap: { height: 470, marginTop: 12, borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: C.line },
  zoneLegend: { position: 'absolute', left: 12, right: 12, bottom: 12, borderRadius: 16, backgroundColor: 'rgba(18,21,18,.94)', padding: 12 },
  zoneLegendTitle: { fontFamily: 'Manrope_800ExtraBold', color: C.white, fontSize: 13 },
  zoneLegendText: { fontFamily: 'Manrope_500Medium', color: '#AAB3AC', fontSize: 10, marginTop: 3 },
  source: { flexDirection: 'row', gap: 10, backgroundColor: C.white, padding: 16, margin: 14, borderRadius: 18 },
  terminalList: { flex: 1, backgroundColor: C.pale, padding: 18 }, repeat: { height: 40, backgroundColor: C.mint, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  historyItem: { gap: 8 },
  historyLabel: { fontFamily: 'Manrope_800ExtraBold', color: C.muted, fontSize: 10, letterSpacing: .8, marginTop: 7, paddingLeft: 2 },
  historyFeedbackBadge: { alignSelf: 'flex-start', height: 30, borderRadius: 10, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  historyFeedbackOk: { backgroundColor: C.mint },
  historyFeedbackReported: { backgroundColor: '#FFF0F0' },
  historyFeedbackOkText: { fontFamily: 'Manrope_700Bold', color: C.green, fontSize: 10 },
  historyFeedbackReportedText: { fontFamily: 'Manrope_700Bold', color: C.red, fontSize: 10 },
  exploreTop: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  exploreKicker: { fontFamily: 'Manrope_800ExtraBold', color: '#9BA49D', fontSize: 10, letterSpacing: 1.5 },
  exploreTitle: { fontFamily: 'Manrope_800ExtraBold', color: C.white, fontSize: 24, marginTop: 2 },
  darkCircle: { width: 49, height: 49, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(18,21,18,.84)', borderWidth: 1, borderColor: 'rgba(255,255,255,.13)' },
  darkCircleSmall: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: '#242824', borderWidth: 1, borderColor: '#363B36' },
  tourPin: { width: 18, height: 18, borderRadius: 9, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center', shadowColor: '#3DA0FF', shadowOpacity: .9, shadowRadius: 8 },
  tourPinActive: { width: 26, height: 26, borderRadius: 13, borderWidth: 3, borderColor: '#3DA0FF' },
  tourPinDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#3DA0FF' },
  placeSheet: { position: 'absolute', left: 12, right: 12, bottom: 86, borderRadius: 30, padding: 18, paddingBottom: 16, backgroundColor: 'rgba(20,23,20,.97)', borderWidth: 1, borderColor: 'rgba(255,255,255,.12)', shadowColor: '#000', shadowOpacity: .5, shadowRadius: 24 },
  placeHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  placeCategory: { fontFamily: 'Manrope_700Bold', color: '#84B69A', fontSize: 10, letterSpacing: .7, textTransform: 'uppercase' },
  placeTitle: { fontFamily: 'Manrope_800ExtraBold', color: C.white, fontSize: 24, marginTop: 2 },
  placeDescription: { fontFamily: 'Manrope_400Regular', color: '#AEB6B0', fontSize: 12, lineHeight: 18, marginTop: 8 },
  placeMeta: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 8 },
  placeMetaText: { fontFamily: 'Manrope_600SemiBold', color: '#7E8A82', fontSize: 10 },
  placeRating: { fontFamily: 'Manrope_700Bold', color: '#E6B934', fontSize: 10, marginLeft: 4 },
  destinationCardOuter: { width: 140, height: 190, borderRadius: 18, backgroundColor: '#173D2D' },
  destinationCardSelected: { borderWidth: 2, borderColor: '#4AD99A' },
  destinationCard: { flex: 1, borderRadius: 17, overflow: 'hidden' },
  destinationCardImage: { ...StyleSheet.absoluteFillObject, width: undefined, height: undefined, resizeMode: 'cover' },
  destinationCardContent: { flex: 1, justifyContent: 'flex-end', padding: 11 },
  destinationCardGo: { position: 'absolute', top: 10, right: 10, zIndex: 3, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(8,48,32,.66)', borderWidth: 1, borderColor: 'rgba(255,255,255,.4)' },
  destinationCardTitle: { fontFamily: 'Manrope_800ExtraBold', color: C.white, fontSize: 14, lineHeight: 17, letterSpacing: -.25 },
  destinationCardStats: { fontFamily: 'Manrope_600SemiBold', color: 'rgba(255,255,255,.78)', fontSize: 7, marginTop: 3 },
  focusedExploreRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 4, paddingBottom: 12 },
  focusedExploreDetails: { flex: 1, minWidth: 0 },
  focusedExploreBack: { alignSelf: 'flex-start', height: 28, paddingHorizontal: 8, marginBottom: 7, borderRadius: 9, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(130,145,136,.16)' },
  focusedExploreBackText: { fontFamily: 'Manrope_700Bold', color: C.white, fontSize: 8 },
  focusedExploreTitle: { fontFamily: 'Manrope_800ExtraBold', color: C.white, fontSize: 17, lineHeight: 21, marginTop: 3 },
  focusedExploreDescription: { fontFamily: 'Manrope_500Medium', color: '#AEB6B0', fontSize: 9, lineHeight: 14, marginTop: 6 },
  goButton: { height: 60, borderRadius: 18, backgroundColor: '#EAF3EC', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, gap: 10 },
  goIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#CBE2D2', alignItems: 'center', justifyContent: 'center' },
  goLabel: { fontFamily: 'Manrope_800ExtraBold', color: '#101310', fontSize: 13 },
  goCaption: { fontFamily: 'Manrope_500Medium', color: '#687269', fontSize: 9 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, issueChip: { paddingHorizontal: 15, paddingVertical: 11, backgroundColor: C.white, borderRadius: 20 }, issueActive: { backgroundColor: C.green },
  issueText: { fontFamily: 'Manrope_700Bold', color: C.ink, fontSize: 12 }, upload: { height: 125, borderWidth: 1, borderStyle: 'dashed', borderColor: '#BFD8CB', borderRadius: 20, backgroundColor: C.mint, alignItems: 'center', justifyContent: 'center', gap: 4 },
  arrivalBanner: { minHeight: 72, borderRadius: 20, padding: 13, backgroundColor: C.mint, flexDirection: 'row', alignItems: 'center', gap: 11 },
  arrivalCheck: { width: 41, height: 41, borderRadius: 21, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  photoActions: { flexDirection: 'row', gap: 10 },
  photoAction: { flex: 1, height: 94, borderWidth: 1, borderStyle: 'dashed', borderColor: '#BFD8CB', borderRadius: 19, backgroundColor: C.mint, alignItems: 'center', justifyContent: 'center', gap: 7 },
  photoPreviewWrap: { height: 190, borderRadius: 20, overflow: 'hidden', backgroundColor: C.line },
  photoPreview: { width: '100%', height: '100%', resizeMode: 'cover' },
  removePhoto: { position: 'absolute', top: 10, right: 10, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(20,22,20,.8)', alignItems: 'center', justifyContent: 'center' },
  noProblemButton: { height: 54, borderRadius: 17, backgroundColor: C.mint, borderWidth: 1, borderColor: '#CBE2D2', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  noProblemText: { fontFamily: 'Manrope_800ExtraBold', color: C.green, fontSize: 13 },
  textarea: { height: 100, backgroundColor: C.white, borderRadius: 20, padding: 15, fontFamily: 'Manrope_400Regular', textAlignVertical: 'top' },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
  appearanceCard: { paddingVertical: 12 },
  appearanceIcon: { width: 43, height: 43, borderRadius: 14, backgroundColor: C.mint, alignItems: 'center', justifyContent: 'center' },
  profilePhoto: { width: 58, height: 58, borderRadius: 20, backgroundColor: C.mint },
  logoutButton: { height: 50, borderRadius: 16, borderWidth: 1, borderColor: '#D6E1DA', backgroundColor: '#EEF4F0', alignItems: 'center', justifyContent: 'center' },
  logoutText: { fontFamily: 'Manrope_800ExtraBold', color: C.ink, fontSize: 12 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 54, borderBottomWidth: 1, borderColor: C.line },
  about: { alignItems: 'center', padding: 30, gap: 4 }, brand: { fontFamily: 'Manrope_800ExtraBold', color: C.green, fontSize: 22 }, developerCredit: { fontFamily: 'Manrope_500Medium', color: C.muted, fontSize: 10, marginTop: 8 }, developerName: { fontFamily: 'Manrope_800ExtraBold', color: C.green, textDecorationLine: 'underline' }, version: { fontFamily: 'Manrope_500Medium', color: '#A0AAA4', fontSize: 10, marginTop: 4 },
});

const lightThemeStyles: Partial<Record<keyof typeof baseStyles, any>> = StyleSheet.create({
  app: { backgroundColor: '#F7F9F7' },
  routeBackButton: { backgroundColor: C.white, borderColor: '#E1E7E3', shadowColor: '#10291D', shadowOpacity: .12 },
  homeExploreSheet: { backgroundColor: 'rgba(255,255,255,.98)', borderColor: '#DDE6E0' },
  placeTitle: { color: C.ink }, placeDescription: { color: '#59675F' }, placeCategory: { color: C.green },
  focusedExploreTitle: { color: C.ink }, focusedExploreDescription: { color: '#59675F' }, focusedExploreBackText: { color: C.ink },
  homeWhereTo: { backgroundColor: '#F0F4F1', borderColor: '#D9E2DC' }, homeWhereTitle: { color: C.ink },
  quick: { backgroundColor: '#F0F4F1', borderColor: '#D9E2DC' }, quickTitle: { color: C.ink },
  panoRouteCard: { backgroundColor: 'rgba(255,255,255,.98)', borderColor: '#DDE6E0' },
  matrixFareBox: { backgroundColor: '#F0F4F1', borderColor: '#D9E2DC' }, matrixFareTitle: { color: C.ink }, matrixValue: { color: C.ink },
  routeMetrics: { backgroundColor: '#F0F4F1' }, routeSearch: { backgroundColor: 'rgba(255,255,255,.98)', borderColor: '#D9E2DC' }, routeInput: { color: C.ink },
  searchResults: { backgroundColor: 'rgba(255,255,255,.99)', borderColor: '#D9E2DC' }, searchResult: { borderColor: '#E4EAE6' }, searchResultTitle: { color: C.ink }, searchResultCaption: { color: C.muted },
  darkCircleSmall: { backgroundColor: C.green, borderColor: '#0A7048' },
  nav: { backgroundColor: 'rgba(255,255,255,.25)', borderColor: 'rgba(255,255,255,.76)' },
});

const darkThemeStyles: Partial<Record<keyof typeof baseStyles, any>> = StyleSheet.create({
  app: { backgroundColor: '#0F1310' }, page: { backgroundColor: '#0F1310' }, pageTop: { backgroundColor: '#0F1310' }, terminalList: { backgroundColor: '#0F1310' },
  card: { backgroundColor: '#1C211D' }, iconButton: { backgroundColor: '#242A25' },
  tool: { backgroundColor: 'rgba(29,35,30,.96)', borderWidth: 1, borderColor: '#465048' },
  headerTitle: { color: '#F4F7F5' }, cardTitle: { color: '#F1F5F2' }, bigValue: { color: '#F1F5F2' }, bold: { color: '#F1F5F2' },
  caption: { color: '#A5B0A8' }, eyebrow: { color: '#91A097' }, lineLabel: { color: '#A5B0A8' }, lineValue: { color: '#F1F5F2' },
  nav: { backgroundColor: 'rgba(15,20,16,.38)', borderColor: 'rgba(255,255,255,.2)' },
  profile: { backgroundColor: '#0F1310' }, appearanceIcon: { backgroundColor: '#26362C' }, developerCredit: { color: '#A5B0A8' },
  input: { color: '#F1F5F2' }, inlineSearch: { backgroundColor: '#1C211D' }, textarea: { backgroundColor: '#1C211D', color: '#F1F5F2' },
  issueChip: { backgroundColor: '#1C211D' }, issueText: { color: '#F1F5F2' }, photoAction: { backgroundColor: '#182A20', borderColor: '#315440' },
  arrivalBanner: { backgroundColor: '#182A20' }, noProblemButton: { backgroundColor: '#182A20', borderColor: '#315440' },
  segment: { backgroundColor: '#182A20' }, segmentActive: { backgroundColor: '#29322C' }, tableHeader: { backgroundColor: '#182A20' }, tableRow: { backgroundColor: '#1C211D', borderColor: '#303832' },
  tableName: { color: '#F1F5F2' }, tableCell: { color: '#A5B0A8' }, tablePrice: { color: '#F1F5F2' }, source: { backgroundColor: '#1C211D' },
  breakdown: { backgroundColor: '#182A20', borderColor: '#315440' }, estimate: { backgroundColor: '#182A20' }, rideCard: { backgroundColor: '#1C211D' },
  statsCard: { backgroundColor: 'rgba(28,33,29,.97)' }, statValue: { color: '#F1F5F2' }, rideSheet: { backgroundColor: '#151A16' }, liveShare: { backgroundColor: '#182A20' }, progressTrack: { backgroundColor: '#364039' },
  specialRow: { backgroundColor: '#202722', borderWidth: 1, borderColor: '#38433B' }, pinLocationButton: { backgroundColor: 'rgba(29,35,30,.97)', borderWidth: 1, borderColor: '#465048' }, logoutButton: { backgroundColor: '#222923', borderColor: '#3C4740' }, logoutText: { color: '#F1F5F2' }, menuRow: { borderColor: '#303832' },
});

const s = new Proxy(baseStyles, {
  get(target, property: string) {
    const key = property as keyof typeof baseStyles;
    const override = (darkModeActive ? darkThemeStyles : lightThemeStyles)[key];
    return override ? [target[key], override] : target[key];
  },
}) as typeof baseStyles;
