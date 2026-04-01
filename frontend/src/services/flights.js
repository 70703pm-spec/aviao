import { getMockFlightsSnapshot } from '../utils/mockFlights';
import { FLIGHT_CACHE_THROTTLE_MS } from '../config/constants';
import {
  classifyAircraft,
  inferMilitaryByCallsign,
  mapClassificationToAircraftType
} from '../utils/aircraftClassification';

const OPEN_SKY_ENDPOINT = process.env.REACT_APP_FLIGHTS_API_URL || 'https://opensky-network.org/api/states/all';
const ADSB_EXCHANGE_ENDPOINT = process.env.REACT_APP_ADSB_EXCHANGE_URL || '';
const ADSB_EXCHANGE_KEY = process.env.REACT_APP_ADSB_EXCHANGE_KEY || '';
const PROVIDER_PREFERENCE = (process.env.REACT_APP_FLIGHT_PROVIDER || 'auto').toLowerCase();

const AIRLINE_PREFIX = {
  AAL: 'American Airlines',
  AFR: 'Air France',
  AIC: 'Air India',
  ANA: 'All Nippon Airways',
  ASA: 'Alaska Airlines',
  AZU: 'Azul',
  BAW: 'British Airways',
  CPA: 'Cathay Pacific',
  DAL: 'Delta',
  DLH: 'Lufthansa',
  ETD: 'Etihad',
  JAL: 'Japan Airlines',
  KLM: 'KLM',
  LAN: 'LATAM',
  QFA: 'Qantas',
  QTR: 'Qatar Airways',
  RYR: 'Ryanair',
  SIA: 'Singapore Airlines',
  THY: 'Turkish Airlines',
  UAE: 'Emirates',
  UAL: 'United'
};

export const PROVIDER_GOVERNANCE = {
  opensky: {
    provider: 'opensky',
    label: 'OpenSky Network',
    className: 'governance-good',
    notes: 'Community data feed; public API rate-limited unless authenticated.',
    usage: 'Good for general global traffic, may degrade under anonymous limits.'
  },
  adsbx: {
    provider: 'adsbx',
    label: 'ADS-B Exchange',
    className: 'governance-caution',
    notes: 'Requires API access and strict terms review before production usage.',
    usage: 'Use only with approved key, endpoint, and licensing governance.'
  },
  mock: {
    provider: 'mock',
    label: 'Simulation Feed',
    className: 'governance-neutral',
    notes: 'Local synthetic feed for development and demos.',
    usage: 'No external data rights concerns; not operational telemetry.'
  }
};

export const ALTITUDE_FILTERS = {
  all: 'All Altitudes',
  low: 'Low (0-3.5 km)',
  cruise: 'Cruise (3.5-9 km)',
  high: 'High (9+ km)',
  descending: 'Descending'
};

export const TYPE_FILTERS = {
  all: 'All Types',
  Military: 'Military',
  Jet: 'Jet',
  Regional: 'Regional',
  Cargo: 'Cargo',
  General: 'General',
  Helicopter: 'Helicopter'
};

export const REGION_FILTERS = {
  all: 'All Regions',
  global: 'Global',
  'north-america': 'North America',
  'south-america': 'South America',
  europe: 'Europe',
  africa: 'Africa',
  'middle-east': 'Middle East',
  'asia-pacific': 'Asia Pacific'
};

const REGION_BOUNDS = {
  'north-america': { latMin: 10, latMax: 74, lonMin: -170, lonMax: -50 },
  'south-america': { latMin: -58, latMax: 14, lonMin: -90, lonMax: -30 },
  europe: { latMin: 34, latMax: 72, lonMin: -25, lonMax: 45 },
  africa: { latMin: -38, latMax: 38, lonMin: -20, lonMax: 53 },
  'middle-east': { latMin: 12, latMax: 43, lonMin: 34, lonMax: 63 },
  'asia-pacific': { latMin: -48, latMax: 66, lonMin: 63, lonMax: 180 }
};

let cachedSnapshot = null;
let lastFetchStartedAt = 0;

function inferAirline(callsign) {
  if (!callsign) {
    return 'Unknown';
  }

  const key = callsign.slice(0, 3).toUpperCase();
  return AIRLINE_PREFIX[key] || key;
}

function inferAircraftType(state) {
  const classification = classifyAircraft(state.icaoType || '', state.category || '');

  if (state.isMilitary || classification === 'military') {
    return 'Military';
  }

  if (classification !== 'airliner') {
    return mapClassificationToAircraftType(classification);
  }

  const velocity = state.velocity || 0;
  const verticalRate = state.verticalRate || 0;
  const altitude = state.altitude || 0;

  if (velocity < 70 && altitude < 2000) {
    return 'Helicopter';
  }

  if (velocity > 230 && altitude > 7000) {
    return 'Jet';
  }

  if (velocity > 190 && verticalRate < 0 && altitude > 4000) {
    return 'Cargo';
  }

  if (velocity > 140) {
    return 'Regional';
  }

  return 'General';
}

function inferRegion(lat, lon) {
  const regionEntry = Object.entries(REGION_BOUNDS).find(([, bounds]) => (
    lat >= bounds.latMin &&
    lat <= bounds.latMax &&
    lon >= bounds.lonMin &&
    lon <= bounds.lonMax
  ));

  return regionEntry ? regionEntry[0] : 'global';
}

function inferMilitary(partial) {
  if (partial.isMilitary === true) {
    return true;
  }

  if (typeof partial.sourceCategory === 'string' && partial.sourceCategory.toLowerCase().includes('mil')) {
    return true;
  }

  if (typeof partial.origin === 'string' && /air force|navy|military/i.test(partial.origin)) {
    return true;
  }

  return inferMilitaryByCallsign(partial.callsign || '');
}

function normalizeFlight(partial, source) {
  if (!Number.isFinite(partial.lat) || !Number.isFinite(partial.lon)) {
    return null;
  }

  const altitude = Number.isFinite(partial.altitude) ? partial.altitude : 0;
  const speed = Number.isFinite(partial.speed) ? partial.speed : 0;
  const heading = Number.isFinite(partial.heading) ? partial.heading : 0;
  const verticalRate = Number.isFinite(partial.verticalRate) ? partial.verticalRate : 0;
  const classification = classifyAircraft(partial.icaoType || '', partial.category || partial.sourceCategory || '');
  const isMilitary = inferMilitary(partial) || classification === 'military';

  return {
    id: partial.id,
    callsign: partial.callsign || partial.id,
    airline: partial.airline || inferAirline(partial.callsign || ''),
    origin: partial.origin || 'Unknown',
    destination: partial.destination || 'N/A',
    originName: partial.originName || partial.origin || 'Unknown',
    destinationName: partial.destinationName || partial.destination || 'Unknown',
    lat: partial.lat,
    lon: partial.lon,
    altitude,
    speed,
    heading,
    verticalRate,
    aircraftType: partial.aircraftType || inferAircraftType({
      velocity: speed,
      altitude,
      verticalRate,
      icaoType: partial.icaoType,
      category: partial.category || partial.sourceCategory,
      isMilitary
    }),
    classification,
    isMilitary,
    icaoType: partial.icaoType || null,
    region: partial.region || inferRegion(partial.lat, partial.lon),
    onGround: Boolean(partial.onGround),
    destinationLat: Number.isFinite(partial.destinationLat) ? partial.destinationLat : null,
    destinationLon: Number.isFinite(partial.destinationLon) ? partial.destinationLon : null,
    updatedAt: partial.updatedAt || Date.now(),
    rawSource: source
  };
}

function withOpenSkyHeaders() {
  const username = process.env.REACT_APP_OPENSKY_USERNAME;
  const password = process.env.REACT_APP_OPENSKY_PASSWORD;

  if (!username || !password) {
    return {};
  }

  const token = btoa(`${username}:${password}`);
  return { Authorization: `Basic ${token}` };
}

async function fetchWithTimeout(url, requestInit = {}, timeoutMs = 9000, externalSignal) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let abortHandler = null;

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      abortHandler = () => controller.abort();
      externalSignal.addEventListener('abort', abortHandler, { once: true });
    }
  }

  try {
    const response = await fetch(url, {
      ...requestInit,
      signal: controller.signal
    });

    return response;
  } finally {
    clearTimeout(timeout);
    if (externalSignal && abortHandler) {
      externalSignal.removeEventListener('abort', abortHandler);
    }
  }
}

async function fetchOpenSkySnapshot(signal) {
  const response = await fetchWithTimeout(OPEN_SKY_ENDPOINT, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...withOpenSkyHeaders()
    }
  }, 9000, signal);

  if (!response.ok) {
    throw new Error(`OpenSky request failed (${response.status})`);
  }

  const payload = await response.json();
  const states = Array.isArray(payload.states) ? payload.states : [];

  const flights = states
    .map((stateRow) => {
      const [
        icao24,
        rawCallsign,
        originCountry,
        ,
        lastContact,
        longitude,
        latitude,
        baroAltitude,
        onGround,
        velocity,
        trueTrack,
        verticalRate,
        ,
        geoAltitude
      ] = stateRow;

      return normalizeFlight({
        id: icao24,
        callsign: (rawCallsign || '').trim() || (icao24 || '').toUpperCase(),
        airline: inferAirline((rawCallsign || '').trim()),
        origin: originCountry || 'Unknown',
        destination: 'N/A',
        originName: originCountry || 'Unknown',
        destinationName: 'Unknown',
        lat: latitude,
        lon: longitude,
        altitude: Number.isFinite(geoAltitude) ? geoAltitude : baroAltitude,
        speed: velocity,
        heading: trueTrack,
        verticalRate,
        onGround,
        updatedAt: lastContact ? lastContact * 1000 : Date.now()
      }, 'opensky');
    })
    .filter(Boolean);

  return {
    source: 'opensky',
    status: flights.length > 0 ? 'online' : 'degraded',
    fetchedAt: new Date().toISOString(),
    flights,
    governance: PROVIDER_GOVERNANCE.opensky
  };
}

async function fetchAdsbExchangeSnapshot(signal) {
  if (!ADSB_EXCHANGE_ENDPOINT || !ADSB_EXCHANGE_KEY) {
    throw new Error('ADSB Exchange provider not configured');
  }

  const response = await fetchWithTimeout(ADSB_EXCHANGE_ENDPOINT, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'api-auth': ADSB_EXCHANGE_KEY
    }
  }, 9000, signal);

  if (!response.ok) {
    throw new Error(`ADSB Exchange request failed (${response.status})`);
  }

  const payload = await response.json();
  const aircraft = Array.isArray(payload.ac) ? payload.ac : [];

  const flights = aircraft
    .map((aircraftEntry) => normalizeFlight({
      id: aircraftEntry.hex || aircraftEntry.r || `adsbx-${Math.random()}`,
      callsign: (aircraftEntry.flight || aircraftEntry.r || '').trim(),
      airline: inferAirline((aircraftEntry.flight || '').trim()),
      origin: aircraftEntry.dbFlags ? 'ADS-BX' : 'Unknown',
      destination: aircraftEntry.to || 'N/A',
      originName: 'ADS-B Exchange',
      destinationName: aircraftEntry.to || 'Unknown',
      lat: aircraftEntry.lat,
      lon: aircraftEntry.lon,
      altitude: Number.isFinite(aircraftEntry.alt_baro)
        ? aircraftEntry.alt_baro * 0.3048
        : Number.isFinite(aircraftEntry.alt_geom)
          ? aircraftEntry.alt_geom * 0.3048
          : 0,
      speed: Number.isFinite(aircraftEntry.gs)
        ? aircraftEntry.gs * 0.514444
        : Number.isFinite(aircraftEntry.tas)
          ? aircraftEntry.tas * 0.514444
          : 0,
      heading: aircraftEntry.track,
      verticalRate: Number.isFinite(aircraftEntry.baro_rate)
        ? aircraftEntry.baro_rate * 0.00508
        : Number.isFinite(aircraftEntry.geom_rate)
          ? aircraftEntry.geom_rate * 0.00508
          : 0,
      icaoType: aircraftEntry.t || aircraftEntry.type,
      sourceCategory: aircraftEntry.category,
      isMilitary: Boolean(aircraftEntry.mil || aircraftEntry.military),
      updatedAt: Number.isFinite(aircraftEntry.seen_pos)
        ? Date.now() - aircraftEntry.seen_pos * 1000
        : Date.now()
    }, 'adsbx'))
    .filter(Boolean);

  return {
    source: 'adsbx',
    status: flights.length > 0 ? 'online' : 'degraded',
    fetchedAt: new Date().toISOString(),
    flights,
    governance: PROVIDER_GOVERNANCE.adsbx
  };
}

function buildMockSnapshot(now) {
  const fallback = getMockFlightsSnapshot(now);

  return {
    ...fallback,
    governance: PROVIDER_GOVERNANCE.mock,
    source: 'mock',
    status: 'mock',
    flights: fallback.flights.map((flight) => normalizeFlight(flight, 'mock')).filter(Boolean)
  };
}

export function matchAltitudeBand(altitude, verticalRate, filterKey) {
  if (filterKey === 'all') {
    return true;
  }

  if (filterKey === 'descending') {
    return verticalRate < -1.5;
  }

  if (filterKey === 'low') {
    return altitude < 3500;
  }

  if (filterKey === 'cruise') {
    return altitude >= 3500 && altitude < 9000;
  }

  if (filterKey === 'high') {
    return altitude >= 9000;
  }

  return true;
}

function providerOrder() {
  if (PROVIDER_PREFERENCE === 'opensky') {
    return ['opensky', 'mock'];
  }

  if (PROVIDER_PREFERENCE === 'adsbx' || PROVIDER_PREFERENCE === 'adsbexchange') {
    return ['adsbx', 'mock'];
  }

  if (PROVIDER_PREFERENCE === 'mock') {
    return ['mock'];
  }

  return ['opensky', 'adsbx', 'mock'];
}

export async function fetchFlightSnapshot(options = {}) {
  const signal = options.signal;
  const now = Date.now();

  if (cachedSnapshot && now - lastFetchStartedAt < FLIGHT_CACHE_THROTTLE_MS) {
    return {
      ...cachedSnapshot,
      cached: true
    };
  }

  lastFetchStartedAt = now;

  const providers = providerOrder();
  const errors = [];

  for (let index = 0; index < providers.length; index += 1) {
    const provider = providers[index];

    try {
      let snapshot;
      if (provider === 'opensky') {
        snapshot = await fetchOpenSkySnapshot(signal);
      } else if (provider === 'adsbx') {
        snapshot = await fetchAdsbExchangeSnapshot(signal);
      } else {
        snapshot = buildMockSnapshot(now);
      }

      if (!snapshot.flights.length) {
        throw new Error(`${provider} returned zero flights`);
      }

      cachedSnapshot = {
        ...snapshot,
        status: provider === 'mock' ? 'mock' : snapshot.status,
        providerTried: providers.slice(0, index + 1),
        providerErrors: errors
      };

      return cachedSnapshot;
    } catch (error) {
      errors.push({ provider, message: error.message });
    }
  }

  const forcedMock = buildMockSnapshot(now);
  cachedSnapshot = {
    ...forcedMock,
    status: 'mock',
    providerErrors: errors,
    error: errors.map((entry) => `${entry.provider}: ${entry.message}`).join(' | ')
  };

  return cachedSnapshot;
}
