import {
  bearingBetween,
  destinationPoint,
  haversineDistanceKm,
  interpolateGreatCircle,
  lerp
} from './geo';

const AIRPORTS = [
  { code: 'KJFK', city: 'New York', lat: 40.6413, lon: -73.7781 },
  { code: 'KLAX', city: 'Los Angeles', lat: 33.9416, lon: -118.4085 },
  { code: 'KORD', city: 'Chicago', lat: 41.9742, lon: -87.9073 },
  { code: 'KATL', city: 'Atlanta', lat: 33.6407, lon: -84.4277 },
  { code: 'CYYZ', city: 'Toronto', lat: 43.6777, lon: -79.6248 },
  { code: 'EGLL', city: 'London', lat: 51.47, lon: -0.4543 },
  { code: 'LFPG', city: 'Paris', lat: 49.0097, lon: 2.5479 },
  { code: 'EDDF', city: 'Frankfurt', lat: 50.0379, lon: 8.5622 },
  { code: 'EHAM', city: 'Amsterdam', lat: 52.3105, lon: 4.7683 },
  { code: 'OMDB', city: 'Dubai', lat: 25.2532, lon: 55.3657 },
  { code: 'OTHH', city: 'Doha', lat: 25.2731, lon: 51.6081 },
  { code: 'VHHH', city: 'Hong Kong', lat: 22.308, lon: 113.9185 },
  { code: 'RJTT', city: 'Tokyo', lat: 35.5494, lon: 139.7798 },
  { code: 'ZBAA', city: 'Beijing', lat: 40.0799, lon: 116.6031 },
  { code: 'WSSS', city: 'Singapore', lat: 1.3644, lon: 103.9915 },
  { code: 'YSSY', city: 'Sydney', lat: -33.9399, lon: 151.1753 },
  { code: 'SBGR', city: 'Sao Paulo', lat: -23.4356, lon: -46.4731 },
  { code: 'SAEZ', city: 'Buenos Aires', lat: -34.8222, lon: -58.5358 },
  { code: 'FAOR', city: 'Johannesburg', lat: -26.1337, lon: 28.242 },
  { code: 'HECA', city: 'Cairo', lat: 30.1219, lon: 31.4056 },
  { code: 'VIDP', city: 'Delhi', lat: 28.5562, lon: 77.1 },
  { code: 'VTBS', city: 'Bangkok', lat: 13.69, lon: 100.7501 },
  { code: 'NZAA', city: 'Auckland', lat: -37.0082, lon: 174.785 },
  { code: 'PHNL', city: 'Honolulu', lat: 21.3187, lon: -157.9225 }
];

const AIRLINES = [
  { code: 'DAL', name: 'Delta' },
  { code: 'UAL', name: 'United' },
  { code: 'AAL', name: 'American' },
  { code: 'AFR', name: 'Air France' },
  { code: 'BAW', name: 'British Airways' },
  { code: 'DLH', name: 'Lufthansa' },
  { code: 'UAE', name: 'Emirates' },
  { code: 'QTR', name: 'Qatar Airways' },
  { code: 'SIA', name: 'Singapore Airlines' },
  { code: 'ANA', name: 'All Nippon Airways' },
  { code: 'QFA', name: 'Qantas' },
  { code: 'KLM', name: 'KLM' },
  { code: 'AZU', name: 'Azul' },
  { code: 'LAN', name: 'LATAM' },
  { code: 'ASA', name: 'Alaska Airlines' }
];

const AIRCRAFT_TYPES = ['Jet', 'Regional', 'Cargo', 'General'];

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function pickRandomAirport(excludedCode) {
  let airport = AIRPORTS[Math.floor(Math.random() * AIRPORTS.length)];
  while (excludedCode && airport.code === excludedCode) {
    airport = AIRPORTS[Math.floor(Math.random() * AIRPORTS.length)];
  }
  return airport;
}

function pickRandomAirline() {
  return AIRLINES[Math.floor(Math.random() * AIRLINES.length)];
}

function createMockFlight(index) {
  const origin = pickRandomAirport();
  const destination = pickRandomAirport(origin.code);
  const airline = pickRandomAirline();

  const progress = randomBetween(0, 1);
  const speed = randomBetween(180, 260);
  const baseAltitude = randomBetween(2400, 11800);
  const distance = haversineDistanceKm(origin.lat, origin.lon, destination.lat, destination.lon);
  const route = interpolateGreatCircle(origin.lat, origin.lon, destination.lat, destination.lon, 90);
  const routeIndex = Math.floor(progress * (route.length - 1));
  const point = route[routeIndex];
  const pointAhead = route[Math.min(routeIndex + 1, route.length - 1)];

  return {
    id: `mock-${String(index).padStart(4, '0')}`,
    callsign: `${airline.code}${Math.floor(randomBetween(100, 9989))}`,
    airline: airline.name,
    origin,
    destination,
    progress,
    distanceKm: Math.max(1, distance),
    speed,
    heading: bearingBetween(point.lat, point.lon, pointAhead.lat, pointAhead.lon),
    altitude: baseAltitude,
    verticalRate: randomBetween(-1.2, 1.2),
    aircraftType: AIRCRAFT_TYPES[Math.floor(Math.random() * AIRCRAFT_TYPES.length)],
    lat: point.lat,
    lon: point.lon,
    updatedAt: Date.now()
  };
}

let fleet = [];
let lastUpdate = Date.now();

function ensureFleet() {
  if (fleet.length > 0) {
    return;
  }

  const defaultCount = 360;
  fleet = Array.from({ length: defaultCount }, (_, index) => createMockFlight(index + 1));
  lastUpdate = Date.now();
}

function rerouteFlight(flight) {
  const nextOrigin = flight.destination;
  const nextDestination = pickRandomAirport(nextOrigin.code);

  flight.origin = nextOrigin;
  flight.destination = nextDestination;
  flight.progress = 0;
  flight.distanceKm = Math.max(1, haversineDistanceKm(nextOrigin.lat, nextOrigin.lon, nextDestination.lat, nextDestination.lon));
  flight.speed = randomBetween(170, 270);
  flight.aircraftType = AIRCRAFT_TYPES[Math.floor(Math.random() * AIRCRAFT_TYPES.length)];
  flight.verticalRate = randomBetween(0.1, 1.1);
}

function updateFlightPosition(flight, deltaSeconds) {
  const progressDelta = (flight.speed * deltaSeconds) / (flight.distanceKm * 1000);
  flight.progress += progressDelta;

  if (flight.progress >= 1) {
    rerouteFlight(flight);
  }

  const route = interpolateGreatCircle(
    flight.origin.lat,
    flight.origin.lon,
    flight.destination.lat,
    flight.destination.lon,
    120
  );

  const routeFloatIndex = flight.progress * (route.length - 1);
  const routeIndex = Math.floor(routeFloatIndex);
  const nextIndex = Math.min(routeIndex + 1, route.length - 1);
  const blend = routeFloatIndex - routeIndex;

  const current = route[routeIndex];
  const next = route[nextIndex];

  const lat = lerp(current.lat, next.lat, blend);
  const lon = lerp(current.lon, next.lon, blend);

  const descentPhase = flight.progress > 0.82;
  const climbPhase = flight.progress < 0.15;

  if (descentPhase) {
    const descentProgress = (flight.progress - 0.82) / 0.18;
    flight.altitude = lerp(flight.altitude, randomBetween(1200, 3400), descentProgress * 0.08);
    flight.verticalRate = randomBetween(-8.2, -3.1);
  } else if (climbPhase) {
    const targetCruise = randomBetween(8500, 11700);
    flight.altitude = lerp(flight.altitude, targetCruise, 0.04);
    flight.verticalRate = randomBetween(2.2, 7.8);
  } else {
    flight.altitude = lerp(flight.altitude, randomBetween(9400, 11800), 0.02);
    flight.verticalRate = randomBetween(-0.8, 0.8);
  }

  flight.heading = bearingBetween(lat, lon, next.lat, next.lon);

  if (!Number.isFinite(flight.heading)) {
    const fallback = destinationPoint(lat, lon, randomBetween(0, 360), 25);
    flight.heading = bearingBetween(lat, lon, fallback.lat, fallback.lon);
  }

  flight.lat = lat;
  flight.lon = lon;
  flight.updatedAt = Date.now();
}

export function getMockFlightsSnapshot(nowMs = Date.now()) {
  ensureFleet();

  const deltaSeconds = Math.min(15, (nowMs - lastUpdate) / 1000 || 1);
  lastUpdate = nowMs;

  fleet.forEach((flight) => updateFlightPosition(flight, deltaSeconds));

  return {
    source: 'mock',
    status: 'mock',
    fetchedAt: new Date(nowMs).toISOString(),
    flights: fleet.map((flight) => ({
      id: flight.id,
      callsign: flight.callsign,
      airline: flight.airline,
      origin: flight.origin.code,
      destination: flight.destination.code,
      originName: flight.origin.city,
      destinationName: flight.destination.city,
      lat: flight.lat,
      lon: flight.lon,
      altitude: flight.altitude,
      speed: flight.speed,
      heading: flight.heading,
      verticalRate: flight.verticalRate,
      aircraftType: flight.aircraftType,
      destinationLat: flight.destination.lat,
      destinationLon: flight.destination.lon,
      updatedAt: flight.updatedAt,
      rawSource: 'mock'
    }))
  };
}
