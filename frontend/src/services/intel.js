import {
  INTEL_POLL_STARTUP_MS,
  INTEL_POLL_STEADY_MS
} from '../config/constants';
import {
  getCuratedCctvFeedCount,
  getCuratedCctvFeeds
} from '../data/cctvCatalog';
import { destinationPoint } from '../utils/geo';

const SATELLITE_API_URL = process.env.REACT_APP_SATELLITE_API_URL || '';
const SEISMIC_API_URL = process.env.REACT_APP_SEISMIC_API_URL || 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson';
const CCTV_API_URL = process.env.REACT_APP_CCTV_API_URL || '';
const STREET_TRAFFIC_API_URL = process.env.REACT_APP_STREET_TRAFFIC_API_URL || '';

const STREET_TRAFFIC_KEY = process.env.REACT_APP_STREET_TRAFFIC_KEY || '';
const SATELLITE_API_KEY = process.env.REACT_APP_SATELLITE_API_KEY || '';
const WINDY_WEBCAMS_KEY = process.env.REACT_APP_WINDY_WEBCAMS_KEY || '';

const REQUEST_TIMEOUT_MS = 9000;
const DEFAULT_PUBLIC_FEED_URL = 'https://www.youtube.com/@earthcam/live';

const liveCache = {
  snapshot: null,
  fetchedAtMs: 0
};

const SATELLITE_SEEDS = [
  { id: 'ISS', name: 'ISS', inclination: 51.6, altitudeKm: 408, periodMin: 92.9, phase: 0.08 },
  { id: 'STARLINK-30211', name: 'STARLINK-30211', inclination: 53.0, altitudeKm: 550, periodMin: 95.5, phase: 0.44 },
  { id: 'STARLINK-1733', name: 'STARLINK-1733', inclination: 53.2, altitudeKm: 540, periodMin: 95.4, phase: 0.61 },
  { id: 'NOAA-20', name: 'NOAA-20', inclination: 98.7, altitudeKm: 824, periodMin: 101.3, phase: 0.31 },
  { id: 'SENTINEL-1A', name: 'SENTINEL-1A', inclination: 98.2, altitudeKm: 693, periodMin: 98.7, phase: 0.73 },
  { id: 'HIMAWARI-9', name: 'HIMAWARI-9', inclination: 0.1, altitudeKm: 35786, periodMin: 1436, phase: 0.17 },
  { id: 'NAVSTAR-72', name: 'NAVSTAR-72', inclination: 55, altitudeKm: 20180, periodMin: 718, phase: 0.54 },
  { id: 'ONEWEB-1178', name: 'ONEWEB-1178', inclination: 87.9, altitudeKm: 1200, periodMin: 109.4, phase: 0.9 }
];

const TRAFFIC_HOTSPOTS = [
  { id: 'nyc', label: 'New York', lat: 40.7128, lon: -74.006 },
  { id: 'la', label: 'Los Angeles', lat: 34.0522, lon: -118.2437 },
  { id: 'london', label: 'London', lat: 51.5074, lon: -0.1278 },
  { id: 'paris', label: 'Paris', lat: 48.8566, lon: 2.3522 },
  { id: 'tokyo', label: 'Tokyo', lat: 35.6762, lon: 139.6503 },
  { id: 'delhi', label: 'Delhi', lat: 28.6139, lon: 77.209 },
  { id: 'sao-paulo', label: 'Sao Paulo', lat: -23.5505, lon: -46.6333 },
  { id: 'dubai', label: 'Dubai', lat: 25.2048, lon: 55.2708 },
  { id: 'singapore', label: 'Singapore', lat: 1.3521, lon: 103.8198 },
  { id: 'johannesburg', label: 'Johannesburg', lat: -26.2041, lon: 28.0473 }
];

const CCTV_NODES = [
  { id: 'nyc-midtown-01', city: 'New York', lat: 40.7582, lon: -73.9856, headingDeg: 112, fovDeg: 32, rangeKm: 2.4, source: 'DOT' },
  { id: 'dc-capitol-02', city: 'Washington DC', lat: 38.8899, lon: -77.0091, headingDeg: 145, fovDeg: 26, rangeKm: 1.6, source: 'Metro Watch' },
  { id: 'la-downtown-03', city: 'Los Angeles', lat: 34.0416, lon: -118.2468, headingDeg: 96, fovDeg: 30, rangeKm: 2.2, source: 'LADOT' },
  { id: 'mex-centro-04', city: 'Mexico City', lat: 19.4326, lon: -99.1332, headingDeg: 188, fovDeg: 34, rangeKm: 2.1, source: 'C5' },
  { id: 'bogota-core-05', city: 'Bogota', lat: 4.711, lon: -74.0721, headingDeg: 118, fovDeg: 32, rangeKm: 1.8, source: 'City Feed' },
  { id: 'lima-core-06', city: 'Lima', lat: -12.0464, lon: -77.0428, headingDeg: 74, fovDeg: 28, rangeKm: 1.7, source: 'Transit Ops' },
  { id: 'santiago-centro-07', city: 'Santiago', lat: -33.4489, lon: -70.6693, headingDeg: 162, fovDeg: 30, rangeKm: 1.9, source: 'City Feed' },
  { id: 'london-city-02', city: 'London', lat: 51.5156, lon: -0.0922, headingDeg: 76, fovDeg: 28, rangeKm: 1.9, source: 'TfL' },
  { id: 'paris-seine-08', city: 'Paris', lat: 48.8566, lon: 2.3522, headingDeg: 124, fovDeg: 30, rangeKm: 1.8, source: 'City Feed' },
  { id: 'berlin-mitte-09', city: 'Berlin', lat: 52.52, lon: 13.405, headingDeg: 102, fovDeg: 28, rangeKm: 1.6, source: 'Urban Grid' },
  { id: 'madrid-sol-10', city: 'Madrid', lat: 40.4168, lon: -3.7038, headingDeg: 80, fovDeg: 32, rangeKm: 1.9, source: 'Transit Ops' },
  { id: 'rome-centro-11', city: 'Rome', lat: 41.9028, lon: 12.4964, headingDeg: 196, fovDeg: 30, rangeKm: 1.7, source: 'City Feed' },
  { id: 'istanbul-bosporus-12', city: 'Istanbul', lat: 41.0082, lon: 28.9784, headingDeg: 142, fovDeg: 34, rangeKm: 2.1, source: 'Metro Watch' },
  { id: 'cairo-nile-13', city: 'Cairo', lat: 30.0444, lon: 31.2357, headingDeg: 118, fovDeg: 30, rangeKm: 1.8, source: 'City Feed' },
  { id: 'lagos-marina-14', city: 'Lagos', lat: 6.455, lon: 3.3841, headingDeg: 86, fovDeg: 34, rangeKm: 2.3, source: 'Urban Grid' },
  { id: 'nairobi-core-15', city: 'Nairobi', lat: -1.2864, lon: 36.8172, headingDeg: 154, fovDeg: 28, rangeKm: 1.6, source: 'Metro Watch' },
  { id: 'joburg-core-16', city: 'Johannesburg', lat: -26.2041, lon: 28.0473, headingDeg: 128, fovDeg: 30, rangeKm: 1.8, source: 'Transit Ops' },
  { id: 'tokyo-shibuya-03', city: 'Tokyo', lat: 35.6596, lon: 139.7006, headingDeg: 210, fovDeg: 36, rangeKm: 2.1, source: 'City Feed' },
  { id: 'dubai-marina-04', city: 'Dubai', lat: 25.0801, lon: 55.1403, headingDeg: 330, fovDeg: 34, rangeKm: 2.7, source: 'RTA' },
  { id: 'riyadh-core-17', city: 'Riyadh', lat: 24.7136, lon: 46.6753, headingDeg: 120, fovDeg: 28, rangeKm: 1.7, source: 'Smart City' },
  { id: 'mumbai-fort-18', city: 'Mumbai', lat: 18.9388, lon: 72.8354, headingDeg: 98, fovDeg: 30, rangeKm: 1.9, source: 'Urban Grid' },
  { id: 'delhi-core-19', city: 'Delhi', lat: 28.6139, lon: 77.209, headingDeg: 142, fovDeg: 32, rangeKm: 2.0, source: 'Transit Ops' },
  { id: 'bangkok-core-20', city: 'Bangkok', lat: 13.7563, lon: 100.5018, headingDeg: 214, fovDeg: 34, rangeKm: 1.9, source: 'City Feed' },
  { id: 'singapore-bay-21', city: 'Singapore', lat: 1.2903, lon: 103.8519, headingDeg: 176, fovDeg: 30, rangeKm: 1.5, source: 'LTA' },
  { id: 'jakarta-core-22', city: 'Jakarta', lat: -6.2088, lon: 106.8456, headingDeg: 102, fovDeg: 34, rangeKm: 2.1, source: 'Metro Watch' },
  { id: 'manila-bay-23', city: 'Manila', lat: 14.5995, lon: 120.9842, headingDeg: 68, fovDeg: 30, rangeKm: 1.8, source: 'City Feed' },
  { id: 'hongkong-central-24', city: 'Hong Kong', lat: 22.3193, lon: 114.1694, headingDeg: 244, fovDeg: 34, rangeKm: 1.7, source: 'Smart City' },
  { id: 'seoul-core-25', city: 'Seoul', lat: 37.5665, lon: 126.978, headingDeg: 130, fovDeg: 30, rangeKm: 1.8, source: 'Metro Watch' },
  { id: 'sydney-harbour-26', city: 'Sydney', lat: -33.8688, lon: 151.2093, headingDeg: 54, fovDeg: 36, rangeKm: 2.0, source: 'Transport NSW' },
  { id: 'auckland-core-27', city: 'Auckland', lat: -36.8485, lon: 174.7633, headingDeg: 92, fovDeg: 30, rangeKm: 1.6, source: 'City Feed' },
  { id: 'sao-centro-05', city: 'Sao Paulo', lat: -23.5501, lon: -46.6339, headingDeg: 145, fovDeg: 38, rangeKm: 1.8, source: 'CET' }
];

function normalizeAngle(deg) {
  let value = deg % 360;
  if (value < 0) {
    value += 360;
  }
  return value;
}

function withTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const externalSignal = options.signal;
  let abortHandler = null;

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      abortHandler = () => controller.abort();
      externalSignal.addEventListener('abort', abortHandler, { once: true });
    }
  }

  return fetch(url, {
    ...options,
    signal: controller.signal
  }).finally(() => {
    clearTimeout(timeout);
    if (externalSignal && abortHandler) {
      externalSignal.removeEventListener('abort', abortHandler);
    }
  });
}

function buildYouTubeEmbedUrl(videoId) {
  return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&playsinline=1&rel=0`;
}

function buildSkylineFeed(
  node,
  externalUrl,
  title = '',
  id = '',
  provider = 'Skyline Webcams',
  source = 'skyline',
  note = ''
) {
  if (!externalUrl) {
    return null;
  }

  return {
    id: id || `skyline-${node.id}`,
    title: title || `${node.city || 'Skyline'} Live Feed`,
    provider,
    source,
    embedUrl: '',
    externalUrl,
    note: note || 'Skyline Webcams restrict inline live embedding on third-party hosts. Use the source link to open the live page, or provide a direct stream URL from your CCTV API for in-dashboard playback.'
  };
}

function buildCuratedFeeds(node) {
  const curatedFeeds = getCuratedCctvFeeds(node?.id);
  if (!curatedFeeds.length) {
    return [];
  }

  return curatedFeeds
    .map((feed, index) => {
      const externalUrl = feed.externalUrl || '';
      const videoId = feed.videoId || extractYouTubeVideoId(externalUrl);

      if (externalUrl.includes('skylinewebcams.com')) {
        return buildSkylineFeed(
          node,
          externalUrl,
          feed.title,
          feed.id || `curated-skyline-${node.id}-${index}`,
          feed.provider || 'Skyline Webcams',
          'curated',
          feed.note
        );
      }

      return {
        id: feed.id || `curated-${node.id}-${index}`,
        title: feed.title || `${node.city || 'CCTV'} Live Feed`,
        provider: feed.provider || 'Curated public camera',
        source: 'curated',
        embedUrl: videoId ? buildYouTubeEmbedUrl(videoId) : '',
        externalUrl: externalUrl || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : ''),
        note: feed.note || 'Using a curated public city camera.'
      };
    })
    .filter(Boolean);
}

function buildFallbackFeed(node, note) {
  return {
    id: `fallback-${node.id}`,
    title: `${node.city || 'CCTV'} live feed unavailable`,
    provider: 'Public CCTV fallback',
    source: 'fallback',
    embedUrl: '',
    externalUrl: DEFAULT_PUBLIC_FEED_URL,
    note
  };
}

function dedupeFeeds(feeds) {
  const seen = new Set();

  return feeds.filter((feed) => {
    if (!feed) {
      return false;
    }

    const key = feed.embedUrl || feed.externalUrl || feed.id;
    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function extractYouTubeVideoId(streamUrl) {
  if (!streamUrl) {
    return '';
  }

  try {
    const url = new URL(streamUrl);
    if (url.hostname.includes('youtu.be')) {
      return url.pathname.replace('/', '').trim();
    }

    if (url.hostname.includes('youtube.com')) {
      if (url.pathname === '/watch') {
        return url.searchParams.get('v') || '';
      }

      if (url.pathname.startsWith('/embed/')) {
        return url.pathname.split('/embed/')[1] || '';
      }

      if (url.pathname.startsWith('/live/')) {
        return url.pathname.split('/live/')[1] || '';
      }
    }
  } catch (error) {
    return '';
  }

  return '';
}

function normalizeDirectFeed(node) {
  const feedUrl = node?.streamUrl || node?.externalUrl || '';
  if (!feedUrl) {
    return null;
  }

  try {
    const url = new URL(feedUrl);
    if (url.hostname.includes('skylinewebcams.com')) {
      return buildSkylineFeed(node, feedUrl, `${node.city || 'Skyline'} Live Feed`);
    }
  } catch (error) {
    // Ignore invalid URLs and continue with remaining detectors.
  }

  const videoId = extractYouTubeVideoId(feedUrl);
  if (videoId) {
    return {
      id: `direct-yt-${node.id}`,
      title: `${node.city || 'CCTV'} Live Feed`,
      provider: 'YouTube / Remote CCTV API',
      source: 'direct',
      embedUrl: buildYouTubeEmbedUrl(videoId),
      externalUrl: `https://www.youtube.com/watch?v=${videoId}`,
      note: 'Loaded from the configured CCTV API stream URL.'
    };
  }

  return {
    id: `direct-${node.id}`,
    title: `${node.city || 'CCTV'} Live Feed`,
    provider: 'Remote CCTV API',
    source: 'direct',
    embedUrl: feedUrl,
    externalUrl: feedUrl,
    note: 'Loaded from the configured CCTV API stream URL.'
  };
}

function extractWindyWebcam(payload) {
  if (Array.isArray(payload?.webcams) && payload.webcams.length) {
    return payload.webcams[0];
  }

  if (Array.isArray(payload?.result?.webcams) && payload.result.webcams.length) {
    return payload.result.webcams[0];
  }

  if (Array.isArray(payload?.data) && payload.data.length) {
    return payload.data[0];
  }

  return null;
}

async function fetchWindyFeed(node, signal) {
  if (!WINDY_WEBCAMS_KEY) {
    return null;
  }

  const endpoint = new URL('https://api.windy.com/webcams/api/v3/webcams');
  endpoint.searchParams.set('nearby', `${node.lat},${node.lon},50`);
  endpoint.searchParams.set('limit', '1');
  endpoint.searchParams.set('include', 'location,player,urls,title');

  const response = await withTimeout(endpoint.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'x-windy-api-key': WINDY_WEBCAMS_KEY
    },
    signal
  });

  if (!response.ok) {
    throw new Error(`Windy webcams lookup failed (${response.status})`);
  }

  const payload = await response.json();
  const webcam = extractWindyWebcam(payload);
  if (!webcam) {
    return null;
  }

  const embedUrl = webcam?.player?.live || webcam?.player?.day || webcam?.urls?.detail || '';
  const externalUrl = webcam?.urls?.detail || webcam?.urls?.current || embedUrl;

  if (!embedUrl && !externalUrl) {
    return null;
  }

  return {
    id: `windy-${webcam.id || node.id}`,
    title: webcam.title || `${node.city || 'Nearby'} Public Webcam`,
    provider: 'Windy Webcams',
    source: 'windy',
    embedUrl: embedUrl || externalUrl,
    externalUrl,
    note: 'Resolved from a nearby public webcam using the Windy Webcams API.'
  };
}

function buildMockSatellites(nowMs = Date.now()) {
  const elapsedMinutes = nowMs / 60000;

  return SATELLITE_SEEDS.map((seed, index) => {
    const phase = (elapsedMinutes / seed.periodMin + seed.phase) % 1;
    const longitude = phase * 360 - 180;
    const latitude = Math.sin(phase * Math.PI * 2) * seed.inclination;
    const heading = normalizeAngle(phase * 360 + 90);

    const trail = Array.from({ length: 10 }, (_, trailIndex) => {
      const ratio = trailIndex / 9;
      const historyPhase = (phase - ratio * 0.07 + 1) % 1;
      return {
        lat: Math.sin(historyPhase * Math.PI * 2) * seed.inclination,
        lon: historyPhase * 360 - 180
      };
    });

    return {
      id: seed.id,
      name: seed.name,
      lat: latitude,
      lon: longitude,
      altitudeKm: seed.altitudeKm,
      heading,
      speedKps: Number((2 * Math.PI * (6371 + seed.altitudeKm) / (seed.periodMin * 60)).toFixed(2)),
      trail,
      status: index % 5 === 0 ? 'relay' : 'active'
    };
  });
}

function buildMockStreetTraffic(nowMs = Date.now()) {
  return TRAFFIC_HOTSPOTS.map((hotspot, index) => {
    const oscillation = (Math.sin(nowMs * 0.00018 + index * 0.7) + 1) / 2;
    const intensity = Math.min(1, 0.25 + oscillation * 0.75);
    const speedKph = Math.round(18 + (1 - intensity) * 64);

    return {
      id: hotspot.id,
      label: hotspot.label,
      lat: hotspot.lat,
      lon: hotspot.lon,
      intensity,
      speedKph,
      congestion: intensity > 0.72 ? 'heavy' : intensity > 0.42 ? 'moderate' : 'light'
    };
  });
}

export function buildMockCctv(nowMs = Date.now()) {
  return CCTV_NODES.map((node, index) => ({
    ...node,
    headingDeg: normalizeAngle(node.headingDeg + Math.sin(nowMs * 0.00016 + index) * 18),
    status: Math.sin(nowMs * 0.0004 + index * 0.8) > -0.75 ? 'online' : 'offline',
    feedCount: getCuratedCctvFeedCount(node.id),
    updatedAt: nowMs
  }));
}

function buildMockSeismic(nowMs = Date.now()) {
  const base = [
    { id: 'mock-seis-1', region: 'Japan Trench', lat: 38.322, lon: 142.369, magnitude: 4.1, depthKm: 34 },
    { id: 'mock-seis-2', region: 'Andes Belt', lat: -20.231, lon: -70.143, magnitude: 3.8, depthKm: 46 },
    { id: 'mock-seis-3', region: 'San Andreas', lat: 35.711, lon: -121.008, magnitude: 2.9, depthKm: 11 },
    { id: 'mock-seis-4', region: 'Aegean Arc', lat: 36.342, lon: 27.994, magnitude: 3.3, depthKm: 18 }
  ];

  return base.map((event, index) => {
    const wave = (Math.sin(nowMs * 0.00022 + index * 1.2) + 1) / 2;
    return {
      ...event,
      magnitude: Number((event.magnitude + wave * 0.5).toFixed(1)),
      detectedAt: new Date(nowMs - Math.round(index * 1000 * 60 * 17)).toISOString(),
      source: 'mock'
    };
  });
}

function mapUsgsEarthquakes(payload) {
  const features = Array.isArray(payload?.features) ? payload.features : [];

  return features
    .slice(0, 120)
    .map((feature) => {
      const coords = feature?.geometry?.coordinates;
      if (!Array.isArray(coords) || coords.length < 2) {
        return null;
      }

      const [lon, lat, depthKm] = coords;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return null;
      }

      return {
        id: feature.id,
        lat,
        lon,
        depthKm: Number.isFinite(depthKm) ? depthKm : 0,
        magnitude: Number.isFinite(feature?.properties?.mag) ? feature.properties.mag : 0,
        region: feature?.properties?.place || 'Unknown region',
        detectedAt: Number.isFinite(feature?.properties?.time)
          ? new Date(feature.properties.time).toISOString()
          : new Date().toISOString(),
        source: 'usgs'
      };
    })
    .filter(Boolean);
}

function mapRemoteSatellites(payload) {
  const records = Array.isArray(payload?.satellites)
    ? payload.satellites
    : Array.isArray(payload)
      ? payload
      : [];

  return records
    .map((record) => {
      if (!Number.isFinite(record?.lat) || !Number.isFinite(record?.lon)) {
        return null;
      }

      const trail = Array.isArray(record.trail)
        ? record.trail
          .filter((point) => Number.isFinite(point?.lat) && Number.isFinite(point?.lon))
          .slice(-10)
        : [];

      return {
        id: record.id || record.name || `sat-${Math.random().toString(36).slice(2)}`,
        name: record.name || record.id || 'Satellite',
        lat: record.lat,
        lon: record.lon,
        altitudeKm: Number.isFinite(record.altitudeKm) ? record.altitudeKm : 550,
        heading: Number.isFinite(record.heading) ? record.heading : 0,
        speedKps: Number.isFinite(record.speedKps) ? record.speedKps : 7.5,
        trail,
        status: record.status || 'active'
      };
    })
    .filter(Boolean);
}

function mapRemoteTraffic(payload) {
  const records = Array.isArray(payload?.traffic)
    ? payload.traffic
    : Array.isArray(payload)
      ? payload
      : [];

  return records
    .map((record) => {
      if (!Number.isFinite(record?.lat) || !Number.isFinite(record?.lon)) {
        return null;
      }

      const intensity = Number.isFinite(record.intensity)
        ? Math.max(0, Math.min(1, record.intensity))
        : 0;

      return {
        id: record.id || `traffic-${Math.random().toString(36).slice(2)}`,
        label: record.label || 'Traffic node',
        lat: record.lat,
        lon: record.lon,
        intensity,
        speedKph: Number.isFinite(record.speedKph) ? record.speedKph : Math.round(18 + (1 - intensity) * 64),
        congestion: record.congestion || (intensity > 0.7 ? 'heavy' : intensity > 0.4 ? 'moderate' : 'light')
      };
    })
    .filter(Boolean);
}

function mapRemoteCctv(payload) {
  const records = Array.isArray(payload?.cctv)
    ? payload.cctv
    : Array.isArray(payload)
      ? payload
      : [];

  return records
    .map((record) => {
      if (!Number.isFinite(record?.lat) || !Number.isFinite(record?.lon)) {
        return null;
      }

      return {
        id: record.id || `cctv-${Math.random().toString(36).slice(2)}`,
        city: record.city || 'Unknown',
        lat: record.lat,
        lon: record.lon,
        headingDeg: Number.isFinite(record.headingDeg) ? normalizeAngle(record.headingDeg) : 0,
        fovDeg: Number.isFinite(record.fovDeg) ? Math.max(8, Math.min(90, record.fovDeg)) : 30,
        rangeKm: Number.isFinite(record.rangeKm) ? Math.max(0.4, Math.min(12, record.rangeKm)) : 2,
        source: record.source || 'remote',
        status: record.status || 'online',
        streamUrl: record.streamUrl || '',
        externalUrl: record.externalUrl || '',
        feedCount: Math.max(
          getCuratedCctvFeedCount(record.id || ''),
          record.streamUrl || record.externalUrl ? 1 : 0
        )
      };
    })
    .filter(Boolean);
}

async function fetchSatellites(nowMs, signal) {
  if (!SATELLITE_API_URL) {
    return {
      source: 'mock',
      items: buildMockSatellites(nowMs),
      note: 'REACT_APP_SATELLITE_API_URL not configured; using orbital simulation.'
    };
  }

  const headers = {
    Accept: 'application/json'
  };

  if (SATELLITE_API_KEY) {
    headers['Authorization'] = `Bearer ${SATELLITE_API_KEY}`;
  }

  const response = await withTimeout(SATELLITE_API_URL, {
    method: 'GET',
    headers,
    signal
  });

  if (!response.ok) {
    throw new Error(`Satellite feed failed (${response.status})`);
  }

  const payload = await response.json();
  const items = mapRemoteSatellites(payload);

  if (!items.length) {
    throw new Error('Satellite feed returned no usable records');
  }

  return {
    source: 'live',
    items,
    note: `Satellite feed connected (${SATELLITE_API_URL})`
  };
}

async function fetchSeismic(nowMs, signal) {
  if (!SEISMIC_API_URL) {
    return {
      source: 'mock',
      items: buildMockSeismic(nowMs),
      note: 'Seismic feed not configured; using synthetic tectonic events.'
    };
  }

  const response = await withTimeout(SEISMIC_API_URL, {
    method: 'GET',
    headers: {
      Accept: 'application/json'
    },
    signal
  });

  if (!response.ok) {
    throw new Error(`Seismic feed failed (${response.status})`);
  }

  const payload = await response.json();
  const items = mapUsgsEarthquakes(payload);

  if (!items.length) {
    throw new Error('Seismic feed returned no usable records');
  }

  return {
    source: 'live',
    items,
    note: 'USGS seismic stream active'
  };
}

async function fetchCctv(nowMs, signal) {
  if (!CCTV_API_URL) {
    return {
      source: 'mock',
      items: buildMockCctv(nowMs),
      note: 'Using the built-in public city camera directory. Add REACT_APP_CCTV_API_URL for your own live CCTV telemetry feed.'
    };
  }

  const response = await withTimeout(CCTV_API_URL, {
    method: 'GET',
    headers: {
      Accept: 'application/json'
    },
    signal
  });

  if (!response.ok) {
    throw new Error(`CCTV feed failed (${response.status})`);
  }

  const payload = await response.json();
  const items = mapRemoteCctv(payload);

  if (!items.length) {
    throw new Error('CCTV feed returned no usable records');
  }

  return {
    source: 'live',
    items,
    note: 'CCTV telemetry online'
  };
}

async function fetchStreetTraffic(nowMs, signal) {
  if (!STREET_TRAFFIC_API_URL) {
    return {
      source: 'mock',
      items: buildMockStreetTraffic(nowMs),
      note: 'Street traffic API not configured; using synthetic congestion fields.'
    };
  }

  const headers = {
    Accept: 'application/json'
  };

  if (STREET_TRAFFIC_KEY) {
    headers['Authorization'] = `Bearer ${STREET_TRAFFIC_KEY}`;
  }

  const response = await withTimeout(STREET_TRAFFIC_API_URL, {
    method: 'GET',
    headers,
    signal
  });

  if (!response.ok) {
    throw new Error(`Traffic feed failed (${response.status})`);
  }

  const payload = await response.json();
  const items = mapRemoteTraffic(payload);

  if (!items.length) {
    throw new Error('Traffic feed returned no usable records');
  }

  return {
    source: 'live',
    items,
    note: 'Street traffic stream active'
  };
}

async function wrapLayer(layerId, loader, fallbackFactory, nowMs, signal) {
  try {
    return await loader(nowMs, signal);
  } catch (error) {
    return {
      source: 'mock',
      items: fallbackFactory(nowMs),
      note: `${layerId} fallback: ${error.message}`,
      error: error.message
    };
  }
}

export async function fetchIntelSnapshot({ signal } = {}) {
  const nowMs = Date.now();
  const minInterval = liveCache.snapshot ? INTEL_POLL_STARTUP_MS : 0;

  if (liveCache.snapshot && nowMs - liveCache.fetchedAtMs < minInterval) {
    return {
      ...liveCache.snapshot,
      cached: true
    };
  }

  const [satellites, seismic, cctv, traffic] = await Promise.all([
    wrapLayer('satellite', fetchSatellites, buildMockSatellites, nowMs, signal),
    wrapLayer('seismic', fetchSeismic, buildMockSeismic, nowMs, signal),
    wrapLayer('cctv', fetchCctv, buildMockCctv, nowMs, signal),
    wrapLayer('traffic', fetchStreetTraffic, buildMockStreetTraffic, nowMs, signal)
  ]);

  const snapshot = {
    fetchedAt: new Date(nowMs).toISOString(),
    satellites: satellites.items,
    seismic: seismic.items,
    cctv: cctv.items,
    streetTraffic: traffic.items,
    sources: {
      satellites: satellites,
      seismic,
      cctv,
      streetTraffic: traffic
    },
    pollCadenceMs: {
      startup: INTEL_POLL_STARTUP_MS,
      steady: INTEL_POLL_STEADY_MS
    }
  };

  liveCache.snapshot = snapshot;
  liveCache.fetchedAtMs = nowMs;

  return snapshot;
}

export function buildProjectedCctvRays(nodes) {
  if (!Array.isArray(nodes)) {
    return [];
  }

  return nodes.map((node) => {
    const left = destinationPoint(node.lat, node.lon, node.headingDeg - node.fovDeg / 2, node.rangeKm);
    const right = destinationPoint(node.lat, node.lon, node.headingDeg + node.fovDeg / 2, node.rangeKm);

    return {
      id: `cctv-ray-${node.id}`,
      lat: node.lat,
      lon: node.lon,
      headingDeg: node.headingDeg,
      arcDeg: node.fovDeg,
      radiusKm: node.rangeKm,
      left,
      right,
      source: node.source,
      status: node.status
    };
  });
}

export async function resolveCctvFeed(node, { signal } = {}) {
  if (!node) {
    return null;
  }

  const feedCandidates = [];
  const directFeed = normalizeDirectFeed(node);
  if (directFeed) {
    feedCandidates.push(directFeed);
  }

  let windyError = '';

  try {
    if (!directFeed) {
      const windyFeed = await fetchWindyFeed(node, signal);
      if (windyFeed) {
        feedCandidates.push(windyFeed);
      }
    }
  } catch (error) {
    windyError = error.message || 'Windy webcam lookup failed';
  }

  feedCandidates.push(...buildCuratedFeeds(node));

  const feeds = dedupeFeeds(feedCandidates);

  if (feeds.length) {
    if (windyError) {
      feeds[0] = {
        ...feeds[0],
        note: `${feeds[0].note} Windy lookup failed: ${windyError}`
      };
    }

    return {
      feeds,
      selectedFeedId: feeds[0].id
    };
  }

  return {
    feeds: [
      buildFallbackFeed(
        node,
        windyError
          ? `Windy lookup failed: ${windyError}. Add REACT_APP_WINDY_WEBCAMS_KEY or provide a direct stream URL in the CCTV API.`
          : 'No direct public feed matched this CCTV node yet. Add REACT_APP_WINDY_WEBCAMS_KEY or provide a direct stream URL in the CCTV API.'
      )
    ],
    selectedFeedId: `fallback-${node.id}`
  };
}
