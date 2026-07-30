import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Animated,
  Dimensions,
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
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import MapView, { Circle as MapCircle, Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import Svg, { Circle, Path } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft, ArrowRight, Calculator, Camera, Check, ChevronRight, Clock3,
  Compass, Flag, History, Home, Layers3, LocateFixed, MapPin, MapPinned, Menu,
  MessageSquareWarning, Navigation, Repeat2, Search, Send, ShieldCheck, SlidersHorizontal,
  Star, Upload, UserRound, X,
} from 'lucide-react-native';
import {
  Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold,
  Manrope_700Bold, Manrope_800ExtraBold, useFonts,
} from '@expo-google-fonts/manrope';
import { FARES, FareEntry, TERMINALS, TOURIST_SPOTS, TouristSpot } from './src/data/fares';
import { computeGoogleRoute, RoutePoint, RouteResult } from './src/services/routing';
import { AgooPlace, searchAgooPlaces } from './src/services/places';

const C = {
  green: '#07834F', deep: '#075E3C', mint: '#E8F4EE', pale: '#F4F7F4',
  ink: '#17211C', muted: '#718078', line: '#DDE6E0', white: '#FFFFFF',
  red: '#E53F48', blue: '#1E69E8', amber: '#F4AE23',
};
type Tab = 'home' | 'fare' | 'history' | 'more';
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
  { barangay: 'Agoo Eco-Fun World', distance: '5.5', regular: 23, special: 18 },
  { barangay: 'Agoo–Damortis Protected Coast', distance: '5.1', regular: 22, special: 18 },
  { barangay: 'Agoo Plaza', distance: '0.3', regular: 20, special: 16 },
  { barangay: 'Agoo Municipal Hall', distance: '0.2', regular: 20, special: 16 },
];
const SEARCHABLE_DESTINATIONS = [...TOURIST_FARE_DESTINATIONS, ...FARES];
const AGOO_MARKET_FARE: FareEntry = { barangay: 'Agoo Public Market Terminal', distance: '0.5', regular: 20, special: 16 };
const VERIFIED_PLACE_PHOTOS: Record<string, number> = {
  'Basilica Minore': require('./assets/places/basilica.jpg'),
  'Museo de Iloko': require('./assets/places/museo.jpg'),
  'Eagle of the North': require('./assets/places/eagle.jpg'),
  'Agoo–Damortis Coast': require('./assets/places/coast.jpg'),
};
const EXPLORE_PLACES = TOURIST_SPOTS.filter(spot => VERIFIED_PLACE_PHOTOS[spot.name]);
const HOME_MAP_SPOTS = TOURIST_SPOTS.filter(spot => !['Agoo Eco-Fun World', 'Agoo–Damortis Coast'].includes(spot.name));
type UserProfile = {
  name: string;
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
};
const HISTORY_KEY = 'tri-fare-agoo:trip-history';
const ACTIVE_TRIP_KEY = 'tri-fare-agoo:active-trip';
const PROFILE_KEY = 'tri-fare-agoo:user-profile';
const SESSION_KEY = 'tri-fare-agoo:signed-in';

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
const AGOO_MESSENGER = 'https://m.me/MunicipalityofAgooLaUnion';
function reportToAgoo(issue: string, ride: string, details = '') {
  const message = `Tri Fare Agoo report\nIssue: ${issue}\nRide: ${ride}${details ? `\nDetails: ${details}` : ''}`;
  Linking.openURL(`${AGOO_MESSENGER}?text=${encodeURIComponent(message)}`)
    .catch(() => Alert.alert('Messenger unavailable', 'Open Municipality of Agoo, La Union on Facebook Messenger.'));
}

function TricycleIcon({ size = 24, color = C.green }: { size?: number; color?: string }) {
  return <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <Circle cx="8" cy="24" r="4" stroke={color} strokeWidth="2.2" />
    <Circle cx="24.5" cy="24" r="4" stroke={color} strokeWidth="2.2" />
    <Path d="M8 24h8.5l-3.2-9.2H9.8m3.5 0h7.2l4 9.2M11 11.5h7.6l3.7 4.2h-9M18.6 11.5V8.8h4.2"
      stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>;
}

function PulsingDestinationMarker() {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
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

export default function App() {
  const [fonts] = useFonts({ Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold });
  if (!fonts) return <View style={{ flex: 1, backgroundColor: C.pale }} />;
  return <SafeAreaProvider><TriFareApp /></SafeAreaProvider>;
}

function TriFareApp() {
  const [profile, setProfile] = useState<UserProfile | null | undefined>(undefined);
  const [screen, setScreen] = useState<Screen>('home');
  const [previous, setPrevious] = useState<Screen>('home');
  const [activeTrip, setActiveTrip] = useState<TripPlan | null>(null);
  const [history, setHistory] = useState<SavedTrip[]>([]);
  const [routeSeed, setRouteSeed] = useState<FareEntry | null>(null);
  const [justArrived, setJustArrived] = useState(false);
  const [arrivedTrip, setArrivedTrip] = useState<SavedTrip | null>(null);
  useEffect(() => {
    Promise.all([AsyncStorage.getItem(PROFILE_KEY), AsyncStorage.getItem(SESSION_KEY)])
      .then(([value, session]) => setProfile(value && session === 'true' ? JSON.parse(value) : null))
      .catch(() => setProfile(null));
    AsyncStorage.getItem(HISTORY_KEY).then(value => value && setHistory(JSON.parse(value))).catch(() => {});
    AsyncStorage.getItem(ACTIVE_TRIP_KEY).then(value => {
      if (!value) return;
      const trip = JSON.parse(value) as TripPlan;
      setActiveTrip(trip); setScreen('ride');
    }).catch(() => {});
  }, []);
  const startTrip = (trip: TripPlan) => {
    setActiveTrip(trip); setScreen('ride');
    AsyncStorage.setItem(ACTIVE_TRIP_KEY, JSON.stringify(trip)).catch(() => {});
  };
  const completeTrip = async (trip: SavedTrip) => {
    const next = [trip, ...history];
    setHistory(next); setActiveTrip(null); setArrivedTrip(trip); setJustArrived(true); setScreen('report');
    await Promise.all([
      AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next)),
      AsyncStorage.removeItem(ACTIVE_TRIP_KEY),
    ]);
  };
  const open = (next: Screen) => { if (next === 'route') setRouteSeed(null); setPrevious(screen); setScreen(next); };
  const goBack = () => setScreen(previous === screen ? 'home' : previous);
  const showNav = ['home', 'fare', 'history', 'more'].includes(screen);
  const tab = (['home', 'fare', 'history', 'more'].includes(screen) ? screen : 'home') as Tab;
  if (profile === undefined) return <View style={[s.flex, { backgroundColor: '#101510' }]} />;
  if (!profile) return <AuthScreen onAuthenticated={setProfile} />;

  return (
    <View style={s.app}>
      <StatusBar style="dark" />
      {screen === 'home' && <HomeScreen open={open} chooseSpot={(spot) => {
        const index = TOURIST_SPOTS.findIndex(item => item.name === spot.name);
        setRouteSeed(TOURIST_FARE_DESTINATIONS[Math.max(0, index)]);
        setScreen('route');
      }} />}
      {screen === 'fare' && <FareCalculator open={open} />}
      {screen === 'terminals' && <TerminalsScreen goBack={() => setScreen('home')} directions={() => { setRouteSeed(AGOO_MARKET_FARE); setScreen('route'); }} />}
      {screen === 'history' && <HistoryScreen rides={history} />}
      {screen === 'more' && <MoreScreen open={open} profile={profile} logout={async () => {
        await AsyncStorage.removeItem(SESSION_KEY);
        setProfile(null); setScreen('home');
      }} />}
      {screen === 'matrix' && <FareMatrix goBack={goBack} />}
      {screen === 'report' && <ReportScreen postTrip={justArrived} trip={arrivedTrip} goBack={() => { setJustArrived(false); setScreen('home'); }} noProblem={() => { setJustArrived(false); setScreen('home'); }} />}
      {screen === 'route' && <RouteScreen goBack={() => setScreen('home')} start={startTrip} initialDestination={routeSeed} />}
      {screen === 'ride' && activeTrip && <RideScreen trip={activeTrip} complete={completeTrip} />}
      {showNav && <BottomNav active={tab} set={(next) => setScreen(next)} />}
    </View>
  );
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: (profile: UserProfile) => void }) {
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserProfile['role']>('Agoo resident');
  const [photoUri, setPhotoUri] = useState('');
  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert('Photo access needed', 'Allow photo access to choose your profile picture.');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: .75, allowsEditing: true, aspect: [1, 1] });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  };
  const submit = async () => {
    if (!name.trim() || !password.trim()) return Alert.alert('Complete your details', 'Enter your name and password.');
    if (mode === 'signup') {
      if (!photoUri) return Alert.alert('Add a profile photo', 'Choose an image before creating your account.');
      const created: UserProfile = { name: name.trim(), password, role, photoUri };
      await Promise.all([
        AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(created)),
        AsyncStorage.setItem(SESSION_KEY, 'true'),
      ]);
      onAuthenticated(created);
      return;
    }
    const saved = await AsyncStorage.getItem(PROFILE_KEY);
    const account = saved ? JSON.parse(saved) as UserProfile : null;
    if (!account || account.name.toLowerCase() !== name.trim().toLowerCase() || account.password !== password) {
      return Alert.alert('Login failed', 'The name or password does not match the account saved on this phone.');
    }
    await AsyncStorage.setItem(SESSION_KEY, 'true');
    onAuthenticated(account);
  };
  return <View style={s.authPage}>
    <StatusBar style="light" />
    <View style={s.authGlow} />
    <SafeAreaView style={s.authSafe} edges={['top', 'bottom']}>
      <View><Text style={s.authKicker}>TRI FARE AGOO</Text><Text style={s.authTitle}>{mode === 'signup' ? 'Welcome aboard.' : 'Welcome back.'}</Text>
        <Text style={s.authSubtitle}>Fair routes, official fares, and safer trips around Agoo.</Text></View>
      <View style={s.authCard}>
        <Pressable style={s.authPhoto} onPress={pickPhoto}>
          {photoUri ? <Image source={{ uri: photoUri }} style={s.authPhotoImage} /> : <><Camera color="#8FE2B5" size={27} /><Text style={s.authPhotoText}>Add photo</Text></>}
        </Pressable>
        <TextInput value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor="#758078" style={s.authInput} />
        {mode === 'signup' && <View style={s.authRoleRow}>
          {(['Agoo resident', 'Tourist'] as const).map(item => <Pressable key={item} onPress={() => setRole(item)} style={[s.authRole, role === item && s.authRoleActive]}>
            <Text style={[s.authRoleText, role === item && { color: C.white }]}>{item}</Text>
          </Pressable>)}
        </View>}
        <TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="Password" placeholderTextColor="#758078" style={s.authInput} />
        <Pressable style={s.authSubmit} onPress={submit}><Text style={s.buttonWhite}>{mode === 'signup' ? 'Create account' : 'Log in'}</Text><ArrowRight color="white" size={19} /></Pressable>
        <Pressable onPress={() => setMode(value => value === 'signup' ? 'login' : 'signup')}><Text style={s.authSwitch}>
          {mode === 'signup' ? 'Already registered? Log in' : 'New to Tri Fare Agoo? Sign up'}
        </Text></Pressable>
      </View>
      <Text style={s.authPrivacy}>Your profile is stored privately on this device.</Text>
    </SafeAreaView>
  </View>;
}

function AppMap({ markers = true, route = false, routePoints, pinnedPoint, follow = false, satellite = false, traffic = false, tilt = true, touristSpots = false, touristSpotItems = TOURIST_SPOTS, selectedSpot, onSpotPress, onMapPress }: { markers?: boolean; route?: boolean; routePoints?: RoutePoint[]; pinnedPoint?: RoutePoint | null; follow?: boolean; satellite?: boolean; traffic?: boolean; tilt?: boolean; touristSpots?: boolean; touristSpotItems?: TouristSpot[]; selectedSpot?: TouristSpot; onSpotPress?: (spot: TouristSpot) => void; onMapPress?: (point: RoutePoint) => void }) {
  const map = useRef<MapView>(null);
  const [region, setRegion] = useState(AGOO);
  const [permission, setPermission] = useState(false);
  useEffect(() => {
    if (!follow) return;
    let watcher: Location.LocationSubscription | undefined;
    (async () => {
      const result = await Location.requestForegroundPermissionsAsync();
      if (result.status !== 'granted') return;
      setPermission(true);
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const next = { ...region, latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setRegion(next); map.current?.animateToRegion(next, 650);
      watcher = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 10 },
        ({ coords }) => map.current?.animateCamera({ center: { latitude: coords.latitude, longitude: coords.longitude } }, { duration: 500 })
      );
    })();
    return () => watcher?.remove();
  }, [follow]);
  useEffect(() => {
    if (!selectedSpot) return;
    map.current?.animateCamera({ center: selectedSpot, pitch: 58, heading: 12, altitude: 950, zoom: 16 }, { duration: 850 });
  }, [selectedSpot]);
  useEffect(() => {
    if (!routePoints || routePoints.length < 2) return;
    map.current?.fitToCoordinates(routePoints, { edgePadding: { top: 120, right: 55, bottom: 330, left: 55 }, animated: true });
  }, [routePoints?.length]);
  return (
    <MapView
      ref={map}
      style={StyleSheet.absoluteFill}
      provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
      initialRegion={region}
      showsUserLocation={permission}
      showsMyLocationButton={false}
      pitchEnabled rotateEnabled
      mapType={satellite ? 'hybrid' : 'standard'}
      showsTraffic={traffic}
      onPress={({ nativeEvent }) => onMapPress?.(nativeEvent.coordinate)}
      camera={{ center: { latitude: region.latitude, longitude: region.longitude }, pitch: tilt ? 58 : 0, heading: tilt ? 8 : 0, altitude: 1800, zoom: 15 }}
    >
      {markers && TERMINALS.map((t, i) => (
        <Marker key={t.name} coordinate={t} title={t.name}>
          <View style={[s.mapPin, i === 1 && { backgroundColor: C.blue }]}><TricycleIcon color="white" size={20} /></View>
        </Marker>
      ))}
      {touristSpots && touristSpotItems.map(spot => <Marker key={spot.name} coordinate={spot} title={spot.name} onPress={() => onSpotPress?.(spot)}>
        {selectedSpot?.name === spot.name ? <PulsingDestinationMarker /> : <View style={s.tourPin}><View style={s.tourPinDot} /></View>}
      </Marker>)}
      {pinnedPoint && <Marker coordinate={pinnedPoint} title="Pinned destination"><View style={s.pinnedMapIcon}><MapPin color="white" size={22} fill="white" /></View></Marker>}
      {routePoints && routePoints.length > 1 && <Polyline coordinates={routePoints} strokeColor="#2188FF" strokeWidth={6} />}
      {route && <Polyline coordinates={routeLine} strokeColor={C.green} strokeWidth={6} />}
    </MapView>
  );
}

function HomeScreen({ open, chooseSpot }: { open: (s: Screen) => void; chooseSpot: (spot: TouristSpot) => void }) {
  const [satellite, setSatellite] = useState(true);
  const [tilt, setTilt] = useState(true);
  const [currentLabel, setCurrentLabel] = useState('Finding your location…');
  const [selectedSpot, setSelectedSpot] = useState<TouristSpot>(TOURIST_SPOTS[0]);
  const [origin, setOrigin] = useState<RoutePoint>({ latitude: AGOO.latitude, longitude: AGOO.longitude });
  const [homeRoute, setHomeRoute] = useState<RoutePoint[]>([]);
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
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setOrigin({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      const places = await Location.reverseGeocodeAsync(position.coords);
      const place = places[0];
      setCurrentLabel(place ? [place.district || place.subregion, place.city, place.region].filter(Boolean).join(', ') : 'Current GPS location');
    })().catch(() => setCurrentLabel('Current GPS location'));
  }, []);
  const animateHomeRoute = async (destination: RoutePoint | string) => {
    setHomeRoute([]);
    try {
      const result = await computeGoogleRoute(origin, destination);
      if (!result?.points.length) throw new Error('No route returned');
      const points = result.points;
      let count = Math.min(2, points.length);
      const step = Math.max(1, Math.ceil(points.length / 45));
      setHomeRoute(points.slice(0, count));
      const timer = setInterval(() => {
        count = Math.min(points.length, count + step);
        setHomeRoute(points.slice(0, count));
        if (count >= points.length) clearInterval(timer);
      }, 24);
    } catch {
      const point = typeof destination === 'string' ? null : destination;
      if (point) setHomeRoute([origin, point]);
    }
  };
  const selectHomeSpot = (spot: TouristSpot) => {
    setSelectedSpot(spot);
    animateHomeRoute({ latitude: spot.latitude, longitude: spot.longitude });
    settleHomeSheet(true);
  };
  return (
    <View style={s.flex}>
      <View style={s.mapArea}><AppMap markers={false} follow satellite={satellite} traffic tilt={tilt} touristSpots touristSpotItems={verifiedSpots} selectedSpot={verifiedSelected} onSpotPress={selectHomeSpot} routePoints={homeRoute} /></View>
      <SafeAreaView style={s.homeOverlay} edges={['top']}>
        <View style={s.homeExploreHeading}>
          <Text style={s.exploreKicker}>DISCOVER AGOO</Text>
        </View>
        <View style={s.mapTools}>
          <Tool icon={<Layers3 size={20} color={C.ink} />} onPress={() => setSatellite(x => !x)} />
          <Tool icon={<LocateFixed size={20} color={C.blue} />} onPress={() => Alert.alert('Live location', 'The map is following your current GPS location.')} />
          <Tool label={tilt ? '3D' : '2D'} onPress={() => setTilt(x => !x)} />
        </View>
      </SafeAreaView>
      <Animated.View {...homeSheetPan.panHandlers} style={[s.homeExploreSheet, { transform: [{ translateY: homeSheetY }] }]}>
        <Pressable hitSlop={8} style={s.dragHandleArea} onPress={() => settleHomeSheet(homeSheetOffset.current === 0)}><View style={s.handle} /></Pressable>
        <View style={s.placeHeader}>
          <View style={s.grow}><Text style={s.placeCategory}>{selectedSpot.category}</Text><Text style={s.placeTitle}>{selectedSpot.name}</Text></View>
        </View>
        <Pressable style={s.exploreGoButton} onPress={() => chooseSpot(selectedSpot)}>
          <Navigation color="white" size={18} fill="white" />
          <Text style={s.buttonWhite}>Go to {selectedSpot.name}</Text>
          <ChevronRight color="white" size={18} />
        </Pressable>
        <Text style={s.placeDescription}>{selectedSpot.description}</Text>
        <View style={s.placeMeta}><MapPin color="#7E8A82" size={15} /><Text style={s.placeMetaText}>{selectedSpot.distance}</Text>
          {spotDetails[selectedSpot.name]?.rating ? <Text style={s.placeRating}>★ {spotDetails[selectedSpot.name].rating?.toFixed(1)} · {spotDetails[selectedSpot.name].reviewCount ?? 0} reviews</Text> : null}
        </View>
        <Pressable style={s.homeWhereTo} onPress={() => open('route')}>
          <Search color="#99A29B" size={23} />
          <View style={s.grow}><Text style={s.homeWhereTitle}>Where are you headed?</Text><Text numberOfLines={1} style={s.homeWhereLocation}>From {currentLabel}</Text></View>
          <View style={s.homeGoCircle}><Navigation color="white" size={18} fill="white" /></View>
        </Pressable>
        <FlatList horizontal data={EXPLORE_PLACES} keyExtractor={item => item.name} showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10, paddingTop: 12, paddingRight: 4 }}
          renderItem={({ item, index }) => <Pressable style={[s.placeThumb, selectedSpot.name === item.name && s.placeThumbActive]} onPress={() => selectHomeSpot(item)}>
            <View style={[s.thumbArt, { backgroundColor: '#34443A' }]}>
              <Image source={VERIFIED_PLACE_PHOTOS[item.name]} style={s.placePhoto} />
            </View>
            <Text numberOfLines={1} style={s.thumbText}>{item.name}</Text>
          </Pressable>} />
      </Animated.View>
    </View>
  );
}

function RouteScreen({ goBack, start, initialDestination }: { goBack: () => void; start: (trip: TripPlan) => void; initialDestination?: FareEntry | null }) {
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
    : selected.barangay.includes('Damortis') ? 'Sta. Rita West fare entry'
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
      const permission = await Location.requestForegroundPermissionsAsync();
      let startPoint = origin;
      if (permission.status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        startPoint = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setOrigin(startPoint);
      }
      const route = await computeGoogleRoute(startPoint, `${entry.barangay}, Agoo, La Union, Philippines`);
      setResult(route);
      if (route?.points.length) map.current?.fitToCoordinates(route.points, { edgePadding: { top: 130, right: 55, bottom: 340, left: 55 }, animated: true });
    } catch {
      Alert.alert('Could not load the road route', 'Check the Google Routes API key or open this trip in Google Maps.');
    } finally { setLoading(false); }
  };
  const loadPointRoute = async (point: RoutePoint, name: string) => {
    setPinMode(false); setCustomPoint(point); setCustomName(name); setQuery(''); setPlaces([]); setLoading(true); setResult(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      let startPoint = origin;
      if (permission.status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        startPoint = { latitude: pos.coords.latitude, longitude: pos.coords.longitude }; setOrigin(startPoint);
      }
      const route = await computeGoogleRoute(startPoint, point); setResult(route);
      if (route?.points.length) map.current?.fitToCoordinates(route.points, { edgePadding: { top: 130, right: 55, bottom: 360, left: 55 }, animated: true });
    } catch { Alert.alert('Route unavailable', 'Could not calculate a road route to this pin.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (initialDestination) loadRoute(initialDestination); }, []);
  const beginTrip = () => {
    if (!result?.points.length) {
      Alert.alert('Road route required', 'Add the Google Routes API key, then reload this destination before starting GPS tracking.');
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
        initialRegion={AGOO} mapType="hybrid" showsTraffic showsBuildings showsUserLocation
        onPress={({ nativeEvent }) => { if (pinMode) loadPointRoute(nativeEvent.coordinate, 'Pinned destination'); }}
        camera={{ center: origin, pitch: 58, heading: 8, altitude: 1800, zoom: 15 }}>
        {animatedRoute.length > 1 ? <Polyline coordinates={animatedRoute} strokeColor="#48A8FF" strokeWidth={6} /> : null}
        <Marker coordinate={origin}><View style={s.routeNode}><Navigation size={15} color="white" fill="white" /></View></Marker>
        {result?.points.length ? <Marker coordinate={result.points[result.points.length - 1]} title={destinationName}><PulsingDestinationMarker /></Marker> : null}
      </MapView>
      <SafeAreaView style={s.routeTopSafe} edges={['top']} pointerEvents="box-none">
        <View style={s.routeTopRow}>
          <IconButton icon={<ArrowLeft size={22} color={C.ink} />} onPress={goBack} />
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
      <Pressable accessibilityLabel={pinMode ? 'Cancel pin location' : 'Pin location'} style={[s.pinLocationButton, pinMode && s.pinLocationButtonActive]} onPress={() => setPinMode(value => !value)}>
        <MapPinned size={21} color={pinMode ? C.white : C.ink} />
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

function RideScreen({ trip, complete }: { trip: TripPlan; complete: (trip: SavedTrip) => void }) {
  const map = useRef<MapView>(null);
  const [sharing, setSharing] = useState(true);
  const [current, setCurrent] = useState<RoutePoint>(trip.origin);
  const [trackedMetres, setTrackedMetres] = useState(0);
  const previousPoint = useRef<RoutePoint>(trip.origin);
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
          previousPoint.current = next; setCurrent(next);
          map.current?.animateCamera({ center: next, pitch: 58, heading: coords.heading ?? 0, zoom: 17 }, { duration: 700 });
        },
      );
    })();
    return () => watcher?.remove();
  }, []);
  const directToDestination = distanceMetres(current, trip.destinationPoint);
  const remainingMetres = routeRemainingMetres(trip.route, current);
  const arrived = directToDestination <= 30;
  const progress = Math.min(1, Math.max(0, 1 - remainingMetres / Math.max(1, trip.routeDistanceKm * 1000)));
  const remainingMinutes = Math.max(1, Math.ceil(trip.etaMinutes * (1 - progress)));
  const finish = () => {
    const drivenKm = Math.max(0, trackedMetres / 1000);
    const regularFare = 20 + Math.ceil(Math.max(0, drivenKm - 4)) * 2;
    const finalFare = trip.special ? Math.round(regularFare * .8) : regularFare;
    complete({
      id: `${Date.now()}`,
      destination: trip.destination,
      completedAt: new Date().toISOString(),
      distanceKm: drivenKm,
      fare: finalFare,
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
        initialRegion={AGOO} mapType="hybrid" showsTraffic showsBuildings showsUserLocation followsUserLocation
        camera={{ center: current, pitch: 58, heading: 0, altitude: 1000, zoom: 17 }}>
        <Polyline coordinates={trip.route} strokeColor="#48A8FF" strokeWidth={7} />
        <Marker coordinate={trip.destinationPoint} title={trip.destination}><View style={s.destinationMarker}><Flag color="white" size={18} fill="white" /></View></Marker>
      </MapView>
      <SafeAreaView style={s.rideStats} edges={['top']}>
        <View style={s.statsCard}>
          <Stat label="TRIP TIME" value={`${remainingMinutes} min`} green /><Stat label="DRIVEN KM" value={`${(trackedMetres / 1000).toFixed(2)} km`} green /><Stat label="LIVE FARE" value={peso((trip.special ? .8 : 1) * (20 + Math.ceil(Math.max(0, trackedMetres / 1000 - 4)) * 2))} green />
        </View>
      </SafeAreaView>
      <View style={s.rideSheet}>
        <View style={s.rowBetween}><View style={s.grow}><Text style={s.cardTitle}>{trip.destination}</Text><Text style={s.caption}>{remainingMetres < 1000 ? `${Math.round(remainingMetres)} m` : `${(remainingMetres / 1000).toFixed(1)} km`} remaining · about {remainingMinutes} min</Text></View><View style={s.liveDot} /></View>
        <View style={s.progressTrack}><View style={[s.progressFill, { width: `${progress * 100}%` }]} /></View>
        <View style={s.liveShare}><ShieldCheck color={C.green} size={22} /><View style={s.grow}>
          <Text style={s.cardTitle}>Real-time GPS tracking is ON</Text><Text style={s.caption}>Arrive activates within 30 metres</Text>
        </View><Switch value={sharing} onValueChange={setSharing} trackColor={{ true: C.green }} /></View>
        <View style={s.row}>
          <Pressable style={[s.actionButton, { backgroundColor: C.mint }]} onPress={() => Share.share({ message: `I’m riding to ${trip.destination}. Live trip via Tri Fare Agoo.` })}><Send color={C.ink} size={21} /><Text style={s.buttonDark}>Share Trip</Text></Pressable>
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

function FareMatrix({ goBack }: { goBack: () => void }) {
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
      {matrixTab === 'zone' ? <View style={s.zoneMapWrap}><MapView style={StyleSheet.absoluteFill} initialRegion={{ ...AGOO, latitudeDelta: .12, longitudeDelta: .1 }} mapType="hybrid" showsTraffic>
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

function TerminalsScreen({ goBack, directions }: { goBack: () => void; directions: () => void }) {
  return (
    <View style={s.flex}>
      <SafeAreaView style={s.pageTop} edges={['top']}><Header title="Nearby Terminals" back={goBack} /></SafeAreaView>
      <View style={{ height: 245 }}><AppMap /></View>
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
  return <Page><Header title="Ride History" right={<IconButton icon={<Search size={20} />} onPress={() => Alert.alert('Search rides', 'Use the destination search on Home to repeat or plan a ride.')} />} />
    {!rides.length && <Card><View style={s.about}><History color={C.green} size={30} /><Text style={s.cardTitle}>No completed rides yet</Text><Text style={s.caption}>Trips appear here after Arrive is confirmed near your destination.</Text></View></Card>}
    {rides.map((r, i) => <View key={r.id}><Text style={s.eyebrow}>{i === 0 ? 'LATEST' : 'PREVIOUS'}</Text><Card>
      <View style={s.row}><View style={s.iconTile}><TricycleIcon /></View><View style={s.grow}><Text style={s.cardTitle}>Current location → {r.destination}</Text><Text style={s.caption}>{new Date(r.completedAt).toLocaleString()} • {r.distanceKm.toFixed(2)} km</Text></View><Text style={s.price}>{peso(r.fare)}</Text></View>
      <Pressable style={s.repeat} onPress={() => Alert.alert('Repeat ride', `${r.destination} is ready to search from Home.`)}><Repeat2 size={17} /><Text style={s.buttonDark}>Repeat This Ride</Text></Pressable>
      <View style={s.reportRideRow}>
        <Pressable style={s.reportRideChip} onPress={() => reportToAgoo('Rude driver', r.destination)}><MessageSquareWarning size={15} color={C.red} /><Text style={s.reportRideText}>Rude driver</Text></Pressable>
        <Pressable style={s.reportRideChip} onPress={() => reportToAgoo('Overpriced fare', `${r.destination} · official fare ${peso(r.fare)}`)}><Flag size={15} color={C.red} /><Text style={s.reportRideText}>Overpriced</Text></Pressable>
      </View>
    </Card></View>)}
  </Page>;
}

function ReportScreen({ goBack, postTrip, trip, noProblem }: { goBack: () => void; postTrip: boolean; trip: SavedTrip | null; noProblem: () => void }) {
  const [issue, setIssue] = useState('Incorrect Fare');
  const [general, setGeneral] = useState(false);
  const [details, setDetails] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
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
  return <Page keyboard><Header title="Report / Feedback" back={goBack} />
    {postTrip && <View style={s.arrivalBanner}><View style={s.arrivalCheck}><Check color="white" size={22} /></View><View style={s.grow}><Text style={s.cardTitle}>Trip saved to history</Text><Text style={s.caption}>Was everything okay with your ride?</Text></View></View>}
    {postTrip && trip && <Card>
      <Text style={s.eyebrow}>COMPLETED TRIP</Text>
      <View style={s.rowBetween}><Text style={s.cardTitle}>{trip.destination}</Text><Text style={s.price}>{peso(trip.fare)}</Text></View>
      <Text style={s.caption}>{trip.distanceKm.toFixed(2)} km travelled by GPS</Text>
      <Text style={s.caption}>Final fare recalculated from the driven distance using the Agoo fare rule.</Text>
    </Card>}
    <Text style={s.eyebrow}>WHAT'S THE ISSUE?</Text>
    <View style={s.wrap}>{['Incorrect Fare', 'Overcharging', 'Rude Driver', 'Wrong Route Info', 'Other'].map(x =>
      <Pressable key={x} onPress={() => setIssue(x)} style={[s.issueChip, issue === x && s.issueActive]}><Text style={[s.issueText, issue === x && { color: 'white' }]}>{x}</Text></Pressable>)}</View>
    <Text style={s.eyebrow}>ADD A PHOTO</Text>
    {photoUri ? <View style={s.photoPreviewWrap}><Image source={{ uri: photoUri }} style={s.photoPreview} /><Pressable style={s.removePhoto} onPress={() => setPhotoUri(null)}><X color="white" size={18} /></Pressable></View>
      : <View style={s.photoActions}>
        <Pressable style={s.photoAction} onPress={takePhoto}><Camera color={C.blue} size={25} /><Text style={s.cardTitle}>Camera</Text></Pressable>
        <Pressable style={s.photoAction} onPress={choosePhoto}><Upload color={C.blue} size={25} /><Text style={s.cardTitle}>Photos</Text></Pressable>
      </View>}
    <Text style={s.eyebrow}>DETAILS</Text>
    <TextInput multiline value={details} onChangeText={setDetails} placeholder="Describe what happened..." style={s.textarea} />
    <Card style={s.row}><MapPin color={C.green} size={22} /><View style={s.grow}><Text style={s.cardTitle}>Location auto-tagged</Text><Text style={s.caption}>Poblacion, Agoo, La Union</Text></View><Check color={C.green} /></Card>
    <Card style={s.rowBetween}><View><Text style={s.cardTitle}>Send as general feedback</Text><Text style={s.caption}>Not tied to fare accuracy</Text></View><Switch value={general} onValueChange={setGeneral} /></Card>
    <PrimaryButton text="Continue in Agoo Messenger" onPress={() => reportToAgoo(general ? 'General feedback' : issue, trip ? `${trip.destination} · ${trip.distanceKm.toFixed(2)} km · ${peso(trip.fare)}` : 'Current ride in Agoo', details)} />
    {postTrip && <Pressable style={s.noProblemButton} onPress={noProblem}><Check color={C.green} size={20} /><Text style={s.noProblemText}>No problem with this ride</Text></Pressable>}
  </Page>;
}

function MoreScreen({ open, profile, logout }: { open: (s: Screen) => void; profile: UserProfile; logout: () => void }) {
  return <Page><Header title="More" /><View style={s.profile}><Image source={{ uri: profile.photoUri }} style={s.profilePhoto} /><View style={s.grow}><Text style={s.cardTitle}>{profile.name}</Text><Text style={s.caption}>{profile.role} · Agoo, La Union</Text></View></View>
    <Card><MenuRow icon={<SlidersHorizontal color={C.green} />} title="Fare Matrix" onPress={() => open('matrix')} /><MenuRow icon={<MessageSquareWarning color={C.red} />} title="Report / Feedback" onPress={() => open('report')} /><MenuRow icon={<ShieldCheck color={C.blue} />} title="Safety & emergency" onPress={() => Alert.alert('Safety tools', 'Live-trip sharing is available after starting a ride.')} /><MenuRow icon={<Star color={C.amber} />} title="Rate Tri Fare Agoo" onPress={() => Alert.alert('Thank you', 'App-store rating will be enabled after public release.')} /></Card>
    <Pressable style={s.logoutButton} onPress={logout}><Text style={s.logoutText}>Log out</Text></Pressable>
    <View style={s.about}><TricycleIcon size={36} /><Text style={s.brand}>Tri Fare Agoo</Text><Text style={s.caption}>Fair rides. Clear fares. Safer journeys.</Text><Text style={s.version}>Version 1.0.0</Text></View>
  </Page>;
}

function BottomNav({ active, set }: { active: Tab; set: (t: Tab) => void }) {
  const items: [Tab, string, React.ReactNode][] = [
    ['home', 'Home', <Home size={21} />], ['fare', 'Fare', <Calculator size={21} />],
    ['history', 'History', <History size={21} />], ['more', 'More', <Menu size={21} />],
  ];
  return <View style={s.nav}>{items.map(([key, label, icon]) =>
    <Pressable key={key} style={[s.navItem, active === key && s.navActive]} onPress={() => set(key)}>
      {React.cloneElement(icon as React.ReactElement<any>, { color: active === key ? C.white : '#707A73', strokeWidth: active === key ? 2.7 : 2 })}
    </Pressable>)}</View>;
}

function Page({ children, keyboard }: { children: React.ReactNode; keyboard?: boolean }) {
  const content = <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.pageContent} showsVerticalScrollIndicator={false}>{children}</ScrollView>;
  return <SafeAreaView style={s.page} edges={['top']}>{keyboard ? <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>{content}</KeyboardAvoidingView> : content}</SafeAreaView>;
}
function Header({ title, back, right }: { title: string; back?: () => void; right?: React.ReactNode }) {
  return <View style={s.header}>{back && <IconButton icon={<ArrowLeft size={22} />} onPress={back} />}<Text style={s.headerTitle}>{title}</Text><View style={{ marginLeft: 'auto' }}>{right}</View></View>;
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
const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: C.pale }, flex: { flex: 1 }, grow: { flex: 1 }, row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  authPage: { flex: 1, backgroundColor: '#0D1711', overflow: 'hidden' },
  authGlow: { position: 'absolute', width: 380, height: 380, borderRadius: 190, backgroundColor: '#0B7549', opacity: .28, top: -170, right: -140 },
  authSafe: { flex: 1, paddingHorizontal: 24, paddingTop: 42, paddingBottom: 22, justifyContent: 'space-between' },
  authKicker: { fontFamily: 'Manrope_800ExtraBold', color: '#62D89B', fontSize: 11, letterSpacing: 2 },
  authTitle: { fontFamily: 'Manrope_800ExtraBold', color: C.white, fontSize: 38, lineHeight: 44, marginTop: 8 },
  authSubtitle: { fontFamily: 'Manrope_500Medium', color: '#9AA99F', fontSize: 13, lineHeight: 20, marginTop: 8, maxWidth: 310 },
  authCard: { borderRadius: 30, padding: 18, gap: 12, backgroundColor: 'rgba(24,31,26,.98)', borderWidth: 1, borderColor: '#303B33' },
  authPhoto: { width: 78, height: 78, borderRadius: 25, alignSelf: 'center', backgroundColor: '#26362C', borderWidth: 1, borderColor: '#3A5948', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  authPhotoImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  authPhotoText: { fontFamily: 'Manrope_700Bold', color: '#8FE2B5', fontSize: 9, marginTop: 3 },
  authInput: { height: 54, borderRadius: 17, backgroundColor: '#303832', color: C.white, paddingHorizontal: 15, fontFamily: 'Manrope_600SemiBold', borderWidth: 1, borderColor: '#414B44' },
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
  mapTools: { position: 'absolute', right: 20, top: 128, gap: 8 }, tool: { width: 40, height: 40, borderRadius: 13, backgroundColor: 'rgba(255,255,255,.96)', alignItems: 'center', justifyContent: 'center' },
  mapPin: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'white' },
  homeSheet: { position: 'absolute', left: 14, right: 14, top: 58, backgroundColor: 'rgba(18,21,18,.97)', borderRadius: 23, borderWidth: 1, borderColor: 'rgba(255,255,255,.12)', padding: 10 },
  homeDiscoverPanel: { position: 'absolute', left: 12, right: 12, top: 50, backgroundColor: 'rgba(18,21,18,.96)', borderRadius: 25, borderWidth: 1, borderColor: 'rgba(255,255,255,.12)', padding: 13, shadowColor: '#000', shadowOpacity: .28, shadowRadius: 18 },
  homeExploreHeading: { paddingTop: 8, paddingLeft: 2 },
  homeExploreSheet: { position: 'absolute', left: 12, right: 12, bottom: 88, borderRadius: 29, padding: 17, backgroundColor: 'rgba(20,23,20,.97)', borderWidth: 1, borderColor: 'rgba(255,255,255,.12)', shadowColor: '#000', shadowOpacity: .5, shadowRadius: 24 },
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
  homeWhereTo: { height: 60, borderRadius: 19, backgroundColor: '#343936', borderWidth: 1, borderColor: '#464C47', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 11, marginTop: 12 },
  exploreGoButton: { height: 48, borderRadius: 16, backgroundColor: C.green, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 12, paddingHorizontal: 14 },
  homeWhereTitle: { fontFamily: 'Manrope_800ExtraBold', color: C.white, fontSize: 14 },
  homeWhereLocation: { fontFamily: 'Manrope_500Medium', color: '#98A19A', fontSize: 9, marginTop: 2 },
  homeGoCircle: { width: 37, height: 37, borderRadius: 19, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center' },
  caption: { fontFamily: 'Manrope_400Regular', fontSize: 12, color: C.muted }, quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 15 },
  quick: { width: '48.5%', minHeight: 68, backgroundColor: '#242824', borderRadius: 18, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderColor: '#303630' },
  iconTile: { width: 45, height: 45, borderRadius: 14, backgroundColor: C.mint, alignItems: 'center', justifyContent: 'center' },
  quickTitle: { flex: 1, fontFamily: 'Manrope_700Bold', color: C.white, fontSize: 13 },
  swipeHint: { fontFamily: 'Manrope_600SemiBold', color: '#6F7972', fontSize: 9, textAlign: 'center', marginTop: 10 },
  nav: { position: 'absolute', bottom: 18, left: 36, right: 36, height: 58, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(18,21,19,.98)', paddingHorizontal: 7, borderWidth: 1, borderColor: '#303530', borderRadius: 29, shadowColor: '#000', shadowOpacity: .38, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, overflow: 'hidden' },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 22, height: 44 }, navActive: { backgroundColor: C.green },
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
  pulseWrap: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center' },
  pinPulse: { position: 'absolute', width: 42, height: 42, borderRadius: 21, backgroundColor: '#36A2FF' },
  wazePin: { width: 39, height: 39, borderRadius: 20, backgroundColor: C.blue, borderWidth: 3, borderColor: 'white', alignItems: 'center', justifyContent: 'center', shadowColor: '#36A2FF', shadowOpacity: .9, shadowRadius: 10 },
  pinnedMapIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.blue, borderWidth: 3, borderColor: C.white, alignItems: 'center', justifyContent: 'center', shadowColor: C.blue, shadowOpacity: .8, shadowRadius: 9 },
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
  reportRideRow: { flexDirection: 'row', gap: 8 },
  reportRideChip: { flex: 1, height: 37, borderRadius: 12, backgroundColor: '#FFF0F0', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  reportRideText: { fontFamily: 'Manrope_700Bold', color: C.red, fontSize: 10 },
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
  placeThumb: { width: 84, opacity: .55 }, placeThumbActive: { opacity: 1 },
  thumbArt: { width: 84, height: 55, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,.1)' },
  placePhoto: { width: '100%', height: '100%', borderRadius: 13, resizeMode: 'cover' },
  thumbText: { fontFamily: 'Manrope_600SemiBold', color: C.white, fontSize: 9, marginTop: 5 },
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
  profilePhoto: { width: 58, height: 58, borderRadius: 20, backgroundColor: C.mint },
  logoutButton: { height: 50, borderRadius: 16, borderWidth: 1, borderColor: '#F0CACA', backgroundColor: '#FFF3F3', alignItems: 'center', justifyContent: 'center' },
  logoutText: { fontFamily: 'Manrope_800ExtraBold', color: C.red, fontSize: 12 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 54, borderBottomWidth: 1, borderColor: C.line },
  about: { alignItems: 'center', padding: 30, gap: 4 }, brand: { fontFamily: 'Manrope_800ExtraBold', color: C.green, fontSize: 22 }, version: { fontFamily: 'Manrope_500Medium', color: '#A0AAA4', fontSize: 10, marginTop: 8 },
});
