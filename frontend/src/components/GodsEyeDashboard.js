import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GlobeCanvas from './GlobeCanvas';
import {
  ALTITUDE_FILTERS,
  fetchFlightSnapshot,
  matchAltitudeBand,
  PROVIDER_GOVERNANCE,
  REGION_FILTERS,
  TYPE_FILTERS
} from '../services/flights';
import { REGION_PRESETS } from '../data/continents';
import { evaluateAlertRules } from '../utils/alerts';
import { createFrontendMetrics } from '../utils/metrics';
import { createRecordingState, summarizeRecordingState, updateRecordingState } from '../utils/recordings';
import { computeFocusedTrackLinks } from '../utils/trackLinking';
import { initAudioEngine } from '../utils/audio';
import { bearingBetween } from '../utils/geo';
import { buildDensitySnapshot } from '../utils/geojsonBuilders';
import { useAdaptivePolling } from '../hooks/useAdaptivePolling';
import {
  buildProjectedCctvRays,
  buildMockCctv,
  fetchIntelSnapshot,
  resolveCctvFeed
} from '../services/intel';
import { getTerrainConfig } from '../services/terrain';
import {
  CAMERA_MODES,
  INTEL_POLL_STARTUP_MS,
  INTEL_POLL_STEADY_MS,
  SNAPSHOT_HISTORY_LIMIT,
  TRAIL_POINT_LIMIT,
  TRAIL_RETENTION_MS,
  VISUAL_SKINS
} from '../config/constants';

const WEBHOOK_URL = process.env.REACT_APP_ALERT_WEBHOOK_URL || '';

const PLAYBACK_SPEEDS = [1, 5, 15, 60, 300];

const FILTER_PRESETS = [
  {
    id: 'global-ops',
    label: 'Global Ops',
    description: 'Reset to wide global watch',
    config: {
      query: '',
      filters: { aircraftType: 'all', altitudeBand: 'all', region: 'all' },
      cameraMode: 'overview',
      cameraRegion: 'global',
      densityMode: false
    }
  },
  {
    id: 'descent-watch',
    label: 'Descent Watch',
    description: 'Highlight aggressive descent traffic',
    config: {
      query: '',
      filters: { aircraftType: 'all', altitudeBand: 'descending', region: 'all' },
      cameraMode: 'region',
      cameraRegion: 'north-america',
      densityMode: true
    }
  },
  {
    id: 'cargo-corridor',
    label: 'Cargo Corridor',
    description: 'Cargo lanes over Europe/Middle East',
    config: {
      query: '',
      filters: { aircraftType: 'Cargo', altitudeBand: 'cruise', region: 'europe' },
      cameraMode: 'sweep',
      cameraRegion: 'europe',
      densityMode: true
    }
  },
  {
    id: 'asia-pacific-flow',
    label: 'Asia Pacific',
    description: 'Traffic pattern sweep in Asia Pacific',
    config: {
      query: '',
      filters: { aircraftType: 'all', altitudeBand: 'all', region: 'asia-pacific' },
      cameraMode: 'sweep',
      cameraRegion: 'asia-pacific',
      densityMode: true
    }
  }
];

function formatUtcTime(value) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(value);
}

function formatSpeed(speedMetersPerSecond) {
  const knots = speedMetersPerSecond * 1.94384;
  return `${Math.round(knots)} kt`;
}

function formatAltitude(altitudeMeters) {
  const feet = altitudeMeters * 3.28084;
  return `${Math.round(feet).toLocaleString()} ft`;
}

function statusLabel(status) {
  switch (status) {
    case 'online':
      return 'LIVE';
    case 'mock':
      return 'SIMULATED';
    case 'degraded':
      return 'DEGRADED';
    default:
      return 'CONNECTING';
  }
}

function matchesQuery(flight, query) {
  if (!query) {
    return true;
  }

  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return [
    flight.callsign,
    flight.airline,
    flight.origin,
    flight.destination,
    flight.originName,
    flight.destinationName
  ]
    .filter(Boolean)
    .some((value) => value.toLowerCase().includes(normalized));
}

function matchesFilters(flight, filters) {
  const typeOk = filters.aircraftType === 'all' || flight.aircraftType === filters.aircraftType;
  const altitudeOk = matchAltitudeBand(flight.altitude, flight.verticalRate, filters.altitudeBand);
  const regionOk = filters.region === 'all' || flight.region === filters.region;

  return typeOk && altitudeOk && regionOk;
}

function computeKinematicHeading(trail, fallbackHeading) {
  if (!Array.isArray(trail) || trail.length < 2) {
    return fallbackHeading || 0;
  }

  const last = trail[trail.length - 1];
  const previous = trail[trail.length - 2];

  return bearingBetween(previous.lat, previous.lon, last.lat, last.lon);
}

function makeSensorVolumes(regionId, selectedFlight) {
  const preset = REGION_PRESETS[regionId] || REGION_PRESETS.global;

  const base = [
    {
      id: `sensor-${regionId}-north`,
      lat: preset.centerLat + 4,
      lon: preset.centerLon - 8,
      headingDeg: 58,
      arcDeg: 54,
      radiusKm: 2200,
      fill: 'rgba(101, 222, 255, 0.1)',
      stroke: 'rgba(136, 240, 255, 0.38)'
    },
    {
      id: `sensor-${regionId}-south`,
      lat: preset.centerLat - 5,
      lon: preset.centerLon + 7,
      headingDeg: 142,
      arcDeg: 46,
      radiusKm: 1850,
      fill: 'rgba(255, 202, 116, 0.09)',
      stroke: 'rgba(255, 210, 132, 0.42)'
    }
  ];

  if (selectedFlight) {
    base.push({
      id: `sensor-target-${selectedFlight.id}`,
      lat: selectedFlight.lat,
      lon: selectedFlight.lon,
      headingDeg: selectedFlight.heading || 0,
      arcDeg: 28,
      radiusKm: 900,
      fill: 'rgba(246, 153, 107, 0.12)',
      stroke: 'rgba(252, 191, 142, 0.5)'
    });
  }

  return base;
}

function GodsEyeDashboard({ currentUser = null, onLogout = null }) {
  const [snapshotHistory, setSnapshotHistory] = useState([]);
  const [playbackActive, setPlaybackActive] = useState(false);
  const [playbackRunning, setPlaybackRunning] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(15);
  const [playbackIndex, setPlaybackIndex] = useState(0);

  const [selectedFlightId, setSelectedFlightId] = useState(null);
  const [selectedCctvId, setSelectedCctvId] = useState(null);
  const [trackTarget, setTrackTarget] = useState(true);
  const [densityMode, setDensityMode] = useState(false);
  const [sensorMode, setSensorMode] = useState(true);
  const [cameraMode, setCameraMode] = useState('overview');
  const [cameraRegion, setCameraRegion] = useState('global');
  const [workspaceMode, setWorkspaceMode] = useState('single');
  const [showAircraft, setShowAircraft] = useState(true);
  const [visualSkin, setVisualSkin] = useState('default');
  const [renderPerformanceMode, setRenderPerformanceMode] = useState('performance');
  const [showCountryNames, setShowCountryNames] = useState(true);
  const [focusTarget, setFocusTarget] = useState(null);
  const [pendingIntelFocus, setPendingIntelFocus] = useState(null);
  const [intelLayers, setIntelLayers] = useState({
    satellites: true,
    military: true,
    seismic: false,
    cctv: true,
    streetTraffic: false
  });
  const [cctvDirectoryQuery, setCctvDirectoryQuery] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    aircraftType: 'all',
    altitudeBand: 'all',
    region: 'all'
  });

  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [connectionMessage, setConnectionMessage] = useState('Connecting to flight stream');
  const [dataSource, setDataSource] = useState('opensky');
  const [providerGovernance, setProviderGovernance] = useState(PROVIDER_GOVERNANCE.mock);
  const [providerErrors, setProviderErrors] = useState([]);

  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [booting, setBooting] = useState(true);
  const [utcTime, setUtcTime] = useState(new Date());
  const [densitySnapshot, setDensitySnapshot] = useState([]);
  const [intelSnapshot, setIntelSnapshot] = useState({
    satellites: [],
    seismic: [],
    cctv: [],
    streetTraffic: [],
    sources: {
      satellites: { source: 'mock', note: 'Booting...' },
      seismic: { source: 'mock', note: 'Booting...' },
      cctv: { source: 'mock', note: 'Booting...' },
      streetTraffic: { source: 'mock', note: 'Booting...' }
    },
    fetchedAt: null
  });
  const [intelStatus, setIntelStatus] = useState('connecting');

  const [recordings, setRecordings] = useState(createRecordingState());
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [alertRouting, setAlertRouting] = useState({ hud: true, webhook: false });
  const [notificationLog, setNotificationLog] = useState([]);
  const [metricsView, setMetricsView] = useState({
    apiLatencyMs: 0,
    renderFps: 0,
    selectionHitMs: 0,
    densityComputeMs: 0
  });
  const [cctvFeedState, setCctvFeedState] = useState({
    status: 'idle',
    feed: null,
    feeds: [],
    error: ''
  });

  const [audioEnabled, setAudioEnabled] = useState(false);

  const audioEngineRef = useRef(null);
  const trailMapRef = useRef(new Map());
  const previousFlightIdsRef = useRef(new Set());
  const lastFetchAtRef = useRef(0);
  const alertsMapRef = useRef(new Map());
  const metricsRef = useRef(createFrontendMetrics());
  const latestFlightsRef = useRef([]);
  const autoPerfTunedRef = useRef(false);
  const terrainConfig = useMemo(() => getTerrainConfig(), []);

  const handleDensityToggle = useCallback(() => {
    setDensityMode((p) => !p);
  }, []);

  const handleTrackTargetToggle = useCallback(() => {
    setTrackTarget((p) => !p);
  }, []);

  const handleSensorModeToggle = useCallback(() => {
    setSensorMode((p) => !p);
  }, []);

  const handleWorkspaceModeToggle = useCallback(() => {
    setWorkspaceMode((p) => (p === 'single' ? 'split' : 'single'));
  }, []);

  const handleAircraftVisibilityToggle = useCallback(() => {
    setShowAircraft((previous) => !previous);
  }, []);

  const handleSatellitesToggle = useCallback(() => {
    setIntelLayers((previous) => ({ ...previous, satellites: !previous.satellites }));
  }, []);

  const handleMilitaryToggle = useCallback(() => {
    setIntelLayers((previous) => ({ ...previous, military: !previous.military }));
  }, []);

  const handleSeismicToggle = useCallback(() => {
    const nextEnabled = !intelLayers.seismic;
    setIntelLayers((previous) => ({ ...previous, seismic: nextEnabled }));

    if (nextEnabled) {
      setPendingIntelFocus('seismic');
      return;
    }

    setPendingIntelFocus((previous) => (previous === 'seismic' ? null : previous));
    setFocusTarget((previous) => (previous?.kind === 'seismic' ? null : previous));
  }, [intelLayers.seismic]);

  const handleCctvToggle = useCallback(() => {
    const nextEnabled = !intelLayers.cctv;
    setIntelLayers((previous) => ({ ...previous, cctv: nextEnabled }));

    if (nextEnabled) {
      setSensorMode(true);
      setPendingIntelFocus('cctv');
      return;
    }

    setSelectedCctvId(null);
    setCctvFeedState({ status: 'idle', feed: null, feeds: [], error: '' });
    setPendingIntelFocus((previous) => (previous === 'cctv' ? null : previous));
    setFocusTarget((previous) => (previous?.kind === 'cctv' ? null : previous));
  }, [intelLayers.cctv]);

  const handleStreetTrafficToggle = useCallback(() => {
    setIntelLayers((previous) => ({ ...previous, streetTraffic: !previous.streetTraffic }));
  }, []);

  const handleVisualSkinChange = useCallback((skinId) => {
    setVisualSkin(skinId);
  }, []);

  const handleCameraModeChange = useCallback((modeId) => {
    setCameraMode(modeId);
  }, []);

  const handlePlaybackToggle = useCallback(() => {
    setPlaybackRunning((p) => !p);
  }, []);

  const handleCountryNamesToggle = useCallback(() => {
    setShowCountryNames((previous) => !previous);
  }, []);

  const handleFlightTrackToggle = useCallback(() => {
    setTrackTarget((previous) => !previous);
  }, []);

  useEffect(() => {
    if (selectedFlightId) {
      setSelectedCctvId(null);
      setCctvFeedState({ status: 'idle', feed: null, feeds: [], error: '' });
      setFocusTarget(null);
      setPendingIntelFocus(null);
      setTrackTarget(true);
      setCameraMode('chase');
    }
  }, [selectedFlightId]);

  useEffect(() => {
    if (showAircraft) {
      return;
    }

    setSelectedFlightId(null);
    setTrackTarget(false);
  }, [showAircraft]);

  useEffect(() => {
    if (intelLayers.cctv && (!intelSnapshot.cctv || intelSnapshot.cctv.length === 0)) {
      setIntelSnapshot((prev) => ({
        ...prev,
        cctv: buildMockCctv(Date.now())
      }));
    }
  }, [intelLayers.cctv, intelSnapshot.cctv]);

  useEffect(() => {
    const bootTimer = setTimeout(() => setBooting(false), 3400);
    return () => clearTimeout(bootTimer);
  }, []);

  useEffect(() => {
    const timeTimer = setInterval(() => {
      setUtcTime(new Date());
    }, 1000);

    return () => clearInterval(timeTimer);
  }, []);

  const handleFlightSnapshot = useCallback((snapshot) => {
    const now = Date.now();
    const trails = trailMapRef.current;
    const seenIds = new Set();

    const flightsWithTrail = snapshot.flights.map((flight) => {
      const history = trails.get(flight.id) || [];
      const trimmedHistory = history
        .filter((entry) => now - entry.timestamp < TRAIL_RETENTION_MS)
        .slice(-(TRAIL_POINT_LIMIT - 1));

      const updatedTrail = [...trimmedHistory, {
        lat: flight.lat,
        lon: flight.lon,
        timestamp: now
      }].slice(-TRAIL_POINT_LIMIT);

      trails.set(flight.id, updatedTrail);
      seenIds.add(flight.id);

      const kinematicHeading = computeKinematicHeading(updatedTrail, flight.heading);

      return {
        ...flight,
        trail: updatedTrail,
        kinematicHeading
      };
    });

    trails.forEach((_, id) => {
      if (!seenIds.has(id)) {
        trails.delete(id);
      }
    });

    const previousIds = previousFlightIdsRef.current;
    const currentIds = new Set(flightsWithTrail.map((flight) => flight.id));
    const newAircraftCount = flightsWithTrail.reduce((total, flight) => (
      previousIds.has(flight.id) ? total : total + 1
    ), 0);

    previousFlightIdsRef.current = currentIds;
    lastFetchAtRef.current = now;
    latestFlightsRef.current = flightsWithTrail;

    setConnectionStatus(snapshot.status || 'online');
    setConnectionMessage(snapshot.error || (snapshot.status === 'mock'
      ? 'Using simulated traffic feed. Configure provider credentials for full live mode.'
      : 'Telemetry stream active'));
    setDataSource(snapshot.source || 'opensky');
    setProviderGovernance(snapshot.governance || PROVIDER_GOVERNANCE.mock);
    setProviderErrors(snapshot.providerErrors || []);
    setLastUpdatedAt(new Date(snapshot.fetchedAt || Date.now()));

    setRecordings((previousRecording) => (
      updateRecordingState(previousRecording, flightsWithTrail, now)
    ));

    setSnapshotHistory((previous) => {
      const next = [...previous, {
        timestamp: now,
        fetchedAt: snapshot.fetchedAt || new Date(now).toISOString(),
        source: snapshot.source || 'unknown',
        status: snapshot.status || 'unknown',
        governance: snapshot.governance || PROVIDER_GOVERNANCE.mock,
        flights: flightsWithTrail
      }];

      if (next.length > SNAPSHOT_HISTORY_LIMIT) {
        return next.slice(next.length - SNAPSHOT_HISTORY_LIMIT);
      }

      return next;
    });

    if (audioEnabled && newAircraftCount > 0 && audioEngineRef.current) {
      audioEngineRef.current.blip();
    }
  }, [audioEnabled]);

  const handleFlightError = useCallback((error) => {
    setConnectionStatus('degraded');
    setConnectionMessage(error.message || 'Failed to update flight feed');
  }, []);

  useAdaptivePolling({
    fastFetcher: async ({ signal }) => {
      const requestStart = performance.now();
      const snapshot = await fetchFlightSnapshot({ signal });
      metricsRef.current.noteApiLatency(performance.now() - requestStart);
      return snapshot;
    },
    slowFetcher: async () => ({ flights: latestFlightsRef.current }),
    onFastData: handleFlightSnapshot,
    onFastError: handleFlightError,
    onSlowData: ({ flights: latestFlights }) => {
      const start = performance.now();
      setDensitySnapshot(buildDensitySnapshot(latestFlights || []));
      metricsRef.current.noteDensityCompute(performance.now() - start);
    },
    onSlowError: () => {},
    hasSteadySignal: (snapshot) => Array.isArray(snapshot?.flights) && snapshot.flights.length > 80
  });

  useEffect(() => {
    let active = true;
    let timerId = null;
    let hasLiveSource = false;

    const pullIntel = async () => {
      try {
        const snapshot = await fetchIntelSnapshot();
        if (!active) {
          return;
        }

        setIntelSnapshot(snapshot);
        hasLiveSource = Object.values(snapshot.sources || {})
          .some((source) => source && source.source === 'live');
        setIntelStatus(hasLiveSource ? 'online' : 'mock');
      } catch (error) {
        if (!active) {
          return;
        }

        setIntelStatus('degraded');
      } finally {
        if (active) {
          const delay = hasLiveSource ? INTEL_POLL_STEADY_MS : INTEL_POLL_STARTUP_MS;
          timerId = setTimeout(pullIntel, delay);
        }
      }
    };

    pullIntel();

    return () => {
      active = false;
      if (timerId) {
        clearTimeout(timerId);
      }
    };
  }, []);

  useEffect(() => {
    if (!snapshotHistory.length) {
      return;
    }

    if (!playbackActive) {
      setPlaybackIndex(snapshotHistory.length - 1);
    } else if (playbackIndex >= snapshotHistory.length) {
      setPlaybackIndex(snapshotHistory.length - 1);
    }
  }, [snapshotHistory, playbackActive, playbackIndex]);

  useEffect(() => {
    if (!playbackActive || !playbackRunning || snapshotHistory.length < 2) {
      return () => {};
    }

    const timer = setInterval(() => {
      setPlaybackIndex((previous) => {
        const step = Math.max(1, Math.round(playbackSpeed / 12));
        const next = previous + step;

        if (next >= snapshotHistory.length - 1) {
          setPlaybackRunning(false);
          return snapshotHistory.length - 1;
        }

        return next;
      });
    }, 500);

    return () => clearInterval(timer);
  }, [playbackActive, playbackRunning, playbackSpeed, snapshotHistory.length]);

  const activeSnapshot = useMemo(() => {
    if (!snapshotHistory.length) {
      return null;
    }

    if (playbackActive) {
      return snapshotHistory[playbackIndex] || snapshotHistory[snapshotHistory.length - 1];
    }

    return snapshotHistory[snapshotHistory.length - 1];
  }, [snapshotHistory, playbackActive, playbackIndex]);

  const flights = useMemo(() => activeSnapshot?.flights || [], [activeSnapshot]);

  useEffect(() => {
    latestFlightsRef.current = flights;
  }, [flights]);

  useEffect(() => {
    if (!selectedFlightId) {
      return;
    }

    const stillPresent = flights.some((flight) => flight.id === selectedFlightId);
    if (!stillPresent) {
      setSelectedFlightId(null);
    }
  }, [flights, selectedFlightId]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.target && event.target.tagName === 'INPUT') {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === '1') {
        setCameraMode('overview');
      }
      if (key === '2') {
        setCameraMode('region');
      }
      if (key === '3') {
        setCameraMode('chase');
      }
      if (key === '4') {
        setCameraMode('sweep');
      }
      if (key === 't') {
        setTrackTarget((previous) => !previous);
      }
      if (key === 'd') {
        setDensityMode((previous) => !previous);
      }
      if (key === 'p') {
        setPlaybackActive((previous) => !previous);
      }
      if (key === 's') {
        setSensorMode((previous) => !previous);
      }
      if (key === 'm') {
        setWorkspaceMode((previous) => (previous === 'single' ? 'split' : 'single'));
      }
      if (key === 'v') {
        const keys = Object.keys(VISUAL_SKINS);
        setVisualSkin((previous) => {
          const index = keys.indexOf(previous);
          const next = index >= 0 ? (index + 1) % keys.length : 0;
          return keys[next];
        });
      }
      if (key === 'g') {
        setIntelLayers((previous) => ({ ...previous, satellites: !previous.satellites }));
      }
      if (key === 'z') {
        handleSeismicToggle();
      }
      if (key === 'x') {
        handleCctvToggle();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleCctvToggle, handleSeismicToggle]);

  useEffect(() => {
    if (!audioEngineRef.current) {
      return () => {};
    }

    audioEngineRef.current.setEnabled(audioEnabled);
    return () => {};
  }, [audioEnabled]);

  useEffect(() => {
    return () => {
      if (audioEngineRef.current) {
        audioEngineRef.current.destroy();
      }
    };
  }, []);

  const hasActiveFilters = useMemo(() => {
    return Boolean(searchQuery.trim()) ||
      filters.aircraftType !== 'all' ||
      filters.altitudeBand !== 'all' ||
      filters.region !== 'all';
  }, [filters, searchQuery]);

  const matchSet = useMemo(() => {
    const matches = new Set();

    flights.forEach((flight) => {
      if (matchesQuery(flight, searchQuery) && matchesFilters(flight, filters)) {
        matches.add(flight.id);
      }
    });

    return matches;
  }, [flights, filters, searchQuery]);

  const selectedFlight = useMemo(() => {
    return flights.find((flight) => flight.id === selectedFlightId) || null;
  }, [flights, selectedFlightId]);

  useEffect(() => {
    if (cameraMode === 'chase' && !selectedFlight) {
      setCameraMode('overview');
      setTrackTarget(false);
    }
  }, [cameraMode, selectedFlight]);

  const matchingCount = matchSet.size;
  const militaryTrackedCount = useMemo(
    () => flights.reduce((total, flight) => (flight.isMilitary ? total + 1 : total), 0),
    [flights]
  );
  const fpsWarning = metricsView.renderFps > 0 && metricsView.renderFps < 20;

  const focusedTrackLinks = useMemo(
    () => computeFocusedTrackLinks(selectedFlight, flights, 10),
    [selectedFlight, flights]
  );

  const linkedTracks = focusedTrackLinks.links;
  const selectedLinkEdges = focusedTrackLinks.edges.slice(0, 14);
  const activeRegionPreset = useMemo(
    () => REGION_PRESETS[cameraRegion] || REGION_PRESETS.global,
    [cameraRegion]
  );
  const globalMiniStaticView = useMemo(() => ({
    cameraMode: 'overview',
    centerLat: 10,
    centerLon: -12,
    zoom: 0.84,
    tiltDeg: 8
  }), []);
  const regionMiniStaticView = useMemo(() => ({
    cameraMode: 'region',
    centerLat: selectedFlight ? selectedFlight.lat : activeRegionPreset.centerLat,
    centerLon: selectedFlight ? selectedFlight.lon : activeRegionPreset.centerLon,
    zoom: selectedFlight ? 1.85 : activeRegionPreset.zoom,
    tiltDeg: 24
  }), [selectedFlight, activeRegionPreset]);

  const satelliteTracks = useMemo(
    () => (intelLayers.satellites ? intelSnapshot.satellites : []),
    [intelLayers.satellites, intelSnapshot.satellites]
  );

  const seismicEvents = useMemo(
    () => (intelLayers.seismic ? intelSnapshot.seismic : []),
    [intelLayers.seismic, intelSnapshot.seismic]
  );

  const streetTraffic = useMemo(
    () => (intelLayers.streetTraffic ? intelSnapshot.streetTraffic : []),
    [intelLayers.streetTraffic, intelSnapshot.streetTraffic]
  );

  const cctvNodes = useMemo(
    () => (intelLayers.cctv ? intelSnapshot.cctv : []),
    [intelLayers.cctv, intelSnapshot.cctv]
  );

  const selectedCctvNode = useMemo(
    () => cctvNodes.find((node) => node.id === selectedCctvId) || null,
    [cctvNodes, selectedCctvId]
  );

  const cctvDirectoryNodes = useMemo(() => {
    const normalizedQuery = cctvDirectoryQuery.trim().toLowerCase();

    return [...cctvNodes]
      .filter((node) => {
        if (!normalizedQuery) {
          return true;
        }

        return `${node.city} ${node.source}`.toLowerCase().includes(normalizedQuery);
      })
      .sort((left, right) => {
        if (left.id === selectedCctvId) {
          return -1;
        }

        if (right.id === selectedCctvId) {
          return 1;
        }

        const feedDelta = (right.feedCount || 0) - (left.feedCount || 0);
        if (feedDelta !== 0) {
          return feedDelta;
        }

        return left.city.localeCompare(right.city);
      })
      .slice(0, 12);
  }, [cctvDirectoryQuery, cctvNodes, selectedCctvId]);

  const cctvSensorVolumes = useMemo(
    () => buildProjectedCctvRays(cctvNodes).map((ray) => ({
      id: ray.id,
      lat: ray.lat,
      lon: ray.lon,
      headingDeg: ray.headingDeg,
      arcDeg: ray.arcDeg,
      radiusKm: ray.radiusKm,
      fill: ray.status === 'online' ? 'rgba(88, 220, 255, 0.08)' : 'rgba(114, 134, 148, 0.06)',
      stroke: ray.status === 'online' ? 'rgba(109, 236, 255, 0.35)' : 'rgba(132, 152, 170, 0.28)'
    })),
    [cctvNodes]
  );

  const sensorVolumes = useMemo(() => (
    [...makeSensorVolumes(cameraRegion, selectedFlight), ...cctvSensorVolumes]
  ), [cameraRegion, selectedFlight, cctvSensorVolumes]);

  const handleCctvFeedSwitch = useCallback((feedId) => {
    if (!feedId) {
      return;
    }

    setCctvFeedState((previous) => {
      const nextFeed = previous.feeds.find((feed) => feed.id === feedId) || previous.feed;
      return {
        ...previous,
        feed: nextFeed || null
      };
    });
  }, []);

  useEffect(() => {
    if (!selectedCctvId) {
      setCctvFeedState({ status: 'idle', feed: null, feeds: [], error: '' });
      return;
    }

    if (!selectedCctvNode) {
      setSelectedCctvId(null);
      setCctvFeedState({ status: 'idle', feed: null, feeds: [], error: '' });
      return;
    }

    let active = true;
    const controller = new AbortController();

    setCctvFeedState({
      status: 'loading',
      feed: null,
      feeds: [],
      error: ''
    });

    resolveCctvFeed(selectedCctvNode, { signal: controller.signal })
      .then((result) => {
        if (!active) {
          return;
        }

        const feeds = Array.isArray(result?.feeds) ? result.feeds : [];
        const initialFeed = feeds.find((feed) => feed.id === result?.selectedFeedId) || feeds[0] || null;

        setCctvFeedState({
          status: initialFeed?.embedUrl || initialFeed?.externalUrl ? 'ready' : 'empty',
          feed: initialFeed,
          feeds,
          error: ''
        });
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        setCctvFeedState({
          status: 'error',
          feed: null,
          feeds: [],
          error: error.message || 'Failed to load CCTV feed'
        });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [selectedCctvId, selectedCctvNode]);

  const focusIntelLocation = useCallback((kind, entry) => {
    if (!entry || !Number.isFinite(entry.lat) || !Number.isFinite(entry.lon)) {
      return;
    }

    setSelectedFlightId(null);
    setTrackTarget(false);
    setCameraMode('region');

    if (kind === 'cctv') {
      setSelectedCctvId(entry.id);
      setSensorMode(true);
    } else {
      setSelectedCctvId(null);
    }

    setFocusTarget({
      id: `${kind}-${entry.id}-${Date.now()}`,
      kind,
      label: kind === 'cctv'
        ? `${entry.city || 'Unknown'} CCTV`
        : (entry.region || 'Seismic event'),
      lat: entry.lat,
      lon: entry.lon,
      zoom: kind === 'cctv' ? 1.94 : 1.62,
      tiltDeg: kind === 'cctv' ? 24 : 18
    });
  }, []);

  const focusSeismicEvent = useCallback((event) => {
    focusIntelLocation('seismic', event);
  }, [focusIntelLocation]);

  const focusCctvNode = useCallback((node) => {
    focusIntelLocation('cctv', node);
  }, [focusIntelLocation]);

  useEffect(() => {
    if (selectedFlightId || !pendingIntelFocus) {
      return;
    }

    if (pendingIntelFocus === 'cctv' && cctvNodes.length) {
      focusCctvNode(cctvNodes.find((node) => node.status !== 'offline') || cctvNodes[0]);
      setPendingIntelFocus(null);
      return;
    }

    if (pendingIntelFocus === 'seismic' && seismicEvents.length) {
      const strongestEvent = [...seismicEvents]
        .sort((left, right) => (right.magnitude || 0) - (left.magnitude || 0))[0];

      if (strongestEvent) {
        focusSeismicEvent(strongestEvent);
        setPendingIntelFocus(null);
      }
    }
  }, [pendingIntelFocus, selectedFlightId, cctvNodes, seismicEvents, focusCctvNode, focusSeismicEvent]);

  useEffect(() => {
    const evaluate = () => {
      const result = evaluateAlertRules({
        nowMs: Date.now(),
        lastFetchMs: lastFetchAtRef.current,
        flights,
        selectedFlight,
        snapshotStatus: activeSnapshot?.status || connectionStatus,
        recordings,
        previousAlertsMap: alertsMapRef.current
      });

      const previousMap = alertsMapRef.current;
      const newlyFired = result.activeAlerts.filter((alert) => !previousMap.has(alert.key));

      alertsMapRef.current = result.alertsMap;
      setActiveAlerts(result.activeAlerts);

      if (newlyFired.length && alertRouting.hud) {
        setNotificationLog((previous) => {
          const merged = [...newlyFired.map((alert) => ({
            id: `${alert.key}-${Date.now()}`,
            time: Date.now(),
            message: alert.message,
            severity: alert.severity,
            channel: 'hud'
          })), ...previous];

          return merged.slice(0, 24);
        });
      }

      if (newlyFired.length && alertRouting.webhook) {
        if (WEBHOOK_URL) {
          newlyFired.forEach((alert) => {
            fetch(WEBHOOK_URL, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                source: 'gods-eye',
                rule: alert.rule,
                severity: alert.severity,
                message: alert.message,
                ts: new Date().toISOString()
              })
            }).catch(() => {
              setNotificationLog((previous) => [{
                id: `webhook-fail-${Date.now()}-${alert.key}`,
                time: Date.now(),
                message: `Webhook dispatch failed for ${alert.rule}`,
                severity: 'warning',
                channel: 'webhook'
              }, ...previous].slice(0, 24));
            });
          });
        } else {
          setNotificationLog((previous) => [{
            id: `webhook-missing-${Date.now()}`,
            time: Date.now(),
            message: 'Webhook routing enabled but REACT_APP_ALERT_WEBHOOK_URL is not configured.',
            severity: 'warning',
            channel: 'webhook'
          }, ...previous].slice(0, 24));
        }
      }
    };

    evaluate();
    const timer = setInterval(evaluate, 4500);

    return () => clearInterval(timer);
  }, [flights, selectedFlight, activeSnapshot, connectionStatus, recordings, alertRouting]);

  useEffect(() => {
    const timer = setInterval(() => {
      setMetricsView(metricsRef.current.snapshot({
        tracked: flights.length,
        alerts: activeAlerts.length
      }));
    }, 1200);

    return () => clearInterval(timer);
  }, [flights.length, activeAlerts.length]);

  useEffect(() => {
    if (autoPerfTunedRef.current) {
      return;
    }

    if (metricsView.renderFps > 0 && metricsView.renderFps < 16) {
      autoPerfTunedRef.current = true;
      setVisualSkin('default');
      setSensorMode(false);
      setDensityMode(false);
      setIntelLayers((previous) => ({
        ...previous,
        seismic: false,
        cctv: false,
        streetTraffic: false
      }));
      setNotificationLog((previous) => [{
        id: `perf-auto-${Date.now()}`,
        time: Date.now(),
        message: 'Auto performance mode applied: heavy overlays reduced for smoother frame rate.',
        severity: 'warning',
        channel: 'hud'
      }, ...previous].slice(0, 24));
    }
  }, [metricsView.renderFps]);

  useEffect(() => {
    const fps = metricsView.renderFps;
    if (!fps || fps <= 0) {
      return;
    }

    setRenderPerformanceMode((previous) => {
      if (fps < 24) {
        return previous === 'ultra' ? previous : 'ultra';
      }

      if (fps < 32) {
        return previous === 'performance' ? previous : 'performance';
      }

      if (fps > 36) {
        return previous === 'balanced' ? previous : 'balanced';
      }

      return previous;
    });
  }, [metricsView.renderFps]);

  const recordingSummary = useMemo(() => summarizeRecordingState(recordings), [recordings]);

  const handleSelectFlight = useCallback((nextFlightId) => {
    setSelectedFlightId(nextFlightId);
    setSelectedCctvId(null);
    setCctvFeedState({ status: 'idle', feed: null, feeds: [], error: '' });
    setFocusTarget(null);
    setPendingIntelFocus(null);

    if (nextFlightId) {
      setCameraMode('chase');
      setTrackTarget(true);
    }

    if (nextFlightId && audioEnabled) {
      if (!audioEngineRef.current) {
        audioEngineRef.current = initAudioEngine();
      }
      audioEngineRef.current.setEnabled(true);
      audioEngineRef.current.lock();
    }
  }, [audioEnabled]);

  const handleSelectCctv = useCallback((nextNodeId) => {
    if (!nextNodeId) {
      setSelectedCctvId(null);
      setCctvFeedState({ status: 'idle', feed: null, feeds: [], error: '' });
      setFocusTarget((previous) => (previous?.kind === 'cctv' ? null : previous));
      return;
    }

    const node = cctvNodes.find((entry) => entry.id === nextNodeId);
    if (!node) {
      setSelectedCctvId(nextNodeId);
      return;
    }

    focusCctvNode(node);
  }, [cctvNodes, focusCctvNode]);

  const handleSelectionHit = useCallback((ms) => {
    metricsRef.current.noteSelectionHit(ms);
  }, []);

  const handleRenderFps = useCallback((fps) => {
    metricsRef.current.noteRenderFps(fps);
  }, []);

  const toggleAudio = useCallback(() => {
    if (!audioEngineRef.current) {
      audioEngineRef.current = initAudioEngine();
    }

    setAudioEnabled((previous) => {
      const next = !previous;
      if (audioEngineRef.current) {
        audioEngineRef.current.setEnabled(next);
      }
      return next;
    });
  }, []);

  const applyPreset = useCallback((preset) => {
    setSearchQuery(preset.config.query);
    setFilters(preset.config.filters);
    setCameraMode(preset.config.cameraMode);
    setCameraRegion(preset.config.cameraRegion);
    setDensityMode(preset.config.densityMode);
  }, []);

  const togglePlaybackMode = useCallback(() => {
    setPlaybackActive((previous) => {
      const next = !previous;
      if (next) {
        setPlaybackRunning(true);
      }
      return next;
    });
  }, []);

  const gotoLive = useCallback(() => {
    setPlaybackActive(false);
    setPlaybackRunning(true);
    setPlaybackIndex(Math.max(0, snapshotHistory.length - 1));
  }, [snapshotHistory.length]);

  return (
    <div className="godseye-shell">
      <div className="hud-topbar">
        {currentUser ? (
          <div className="hud-section">
            <span className="hud-label">Operator</span>
            <span className="hud-value">{currentUser.displayName || currentUser.username}</span>
          </div>
        ) : null}

        <div className="hud-section">
          <span className="hud-label">UTC</span>
          <span className="hud-value">{formatUtcTime(utcTime)}</span>
        </div>

        <div className="hud-section">
          <span className="hud-label">Tracking</span>
          <span className="hud-value">{flights.length.toLocaleString()} aircraft worldwide</span>
        </div>

        <div className="hud-section">
          <span className="hud-label">Military ADS-B</span>
          <span className="hud-value">{militaryTrackedCount.toLocaleString()} tracks</span>
        </div>

        <div className="hud-section">
          <span className="hud-label">Terrain</span>
          <span className="hud-value">{terrainConfig.label}{terrainConfig.ready ? '' : ' (Fallback)'}</span>
        </div>

        <div className="hud-section">
          <span className="hud-label">Mode</span>
          <span className="hud-value">{playbackActive ? 'Playback' : 'Live'}</span>
        </div>

        <div className="hud-section hud-status">
          <span className={`status-dot status-${connectionStatus}`} />
          <span className="hud-value">{statusLabel(connectionStatus)}</span>
        </div>

        {typeof onLogout === 'function' ? (
          <button type="button" className="hud-logout" onClick={onLogout}>
            Log Out
          </button>
        ) : null}
      </div>

      <div className="globe-stage">
        <GlobeCanvas
          flights={flights}
          densityMode={densityMode}
          densitySnapshot={densitySnapshot}
          satellites={satelliteTracks}
          seismicEvents={seismicEvents}
          cctvNodes={cctvNodes}
          streetTraffic={streetTraffic}
          visualSkin={visualSkin}
          highlightMilitary={intelLayers.military}
          performanceMode={renderPerformanceMode}
          showAircraft={showAircraft}
          selectedFlightId={selectedFlightId}
          selectedCctvId={selectedCctvId}
          onSelectFlight={handleSelectFlight}
          onSelectCctv={handleSelectCctv}
          cameraMode={cameraMode}
          cameraRegion={cameraRegion}
          matchSet={matchSet}
          hasActiveFilters={hasActiveFilters}
          trackTarget={trackTarget}
          sensorMode={sensorMode}
          sensorVolumes={sensorVolumes}
          linkEdges={selectedLinkEdges}
          onSelectionHit={handleSelectionHit}
          onRenderFps={handleRenderFps}
          showCountryNames={showCountryNames}
          focusTarget={focusTarget}
        />

        {workspaceMode === 'split' && (
          <div className="multi-view-panes">
            <div className="mini-pane">
              <div className="mini-title">Global Tactical</div>
              <GlobeCanvas
                flights={flights}
                densityMode={densityMode}
                densitySnapshot={densitySnapshot}
                satellites={satelliteTracks}
                seismicEvents={seismicEvents}
                cctvNodes={[]}
                streetTraffic={streetTraffic}
                visualSkin={visualSkin}
                highlightMilitary={intelLayers.military}
                performanceMode={renderPerformanceMode}
                showAircraft={showAircraft}
                selectedFlightId={selectedFlightId}
                selectedCctvId={null}
                cameraMode="overview"
                cameraRegion="global"
                matchSet={matchSet}
                hasActiveFilters={hasActiveFilters}
                trackTarget={false}
                sensorMode={sensorMode}
                sensorVolumes={sensorVolumes}
                linkEdges={selectedLinkEdges}
                mini
                disableSelection
                staticView={globalMiniStaticView}
              />
            </div>

            <div className="mini-pane">
              <div className="mini-title">Region Tactical</div>
              <GlobeCanvas
                flights={flights}
                densityMode={densityMode}
                densitySnapshot={densitySnapshot}
                satellites={satelliteTracks}
                seismicEvents={seismicEvents}
                cctvNodes={[]}
                streetTraffic={streetTraffic}
                visualSkin={visualSkin}
                highlightMilitary={intelLayers.military}
                performanceMode={renderPerformanceMode}
                showAircraft={showAircraft}
                selectedFlightId={selectedFlightId}
                selectedCctvId={null}
                cameraMode="region"
                cameraRegion={cameraRegion}
                matchSet={matchSet}
                hasActiveFilters={hasActiveFilters}
                trackTarget={false}
                sensorMode={sensorMode}
                sensorVolumes={sensorVolumes}
                linkEdges={selectedLinkEdges}
                mini
                disableSelection
                staticView={regionMiniStaticView}
              />
            </div>
          </div>
        )}
      </div>

      <div className="hud-controls">
        <div className="control-block">
          <label htmlFor="search">Search</label>
          <input
            id="search"
            type="text"
            value={searchQuery}
            placeholder="Callsign, airline, origin, destination"
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>

        <div className="control-grid">
          <label>
            Aircraft
            <select
              value={filters.aircraftType}
              onChange={(event) => setFilters((previous) => ({
                ...previous,
                aircraftType: event.target.value
              }))}
            >
              {Object.entries(TYPE_FILTERS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>

          <label>
            Altitude
            <select
              value={filters.altitudeBand}
              onChange={(event) => setFilters((previous) => ({
                ...previous,
                altitudeBand: event.target.value
              }))}
            >
              {Object.entries(ALTITUDE_FILTERS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>

          <label>
            Region
            <select
              value={filters.region}
              onChange={(event) => {
                const value = event.target.value;
                setFilters((previous) => ({ ...previous, region: value }));
                if (value !== 'all') {
                  setCameraRegion(value);
                }
              }}
            >
              {Object.entries(REGION_FILTERS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="preset-row">
          {FILTER_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset)}
              title={preset.description}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="toggle-row">
          <button type="button" className={showAircraft ? 'active' : ''} onClick={handleAircraftVisibilityToggle}>
            Planes {showAircraft ? 'On' : 'Off'}
          </button>

          <button type="button" className={densityMode ? 'active' : ''} onClick={handleDensityToggle}>
            Density {densityMode ? 'On' : 'Off'}
          </button>

          <button type="button" className={trackTarget ? 'active' : ''} onClick={handleTrackTargetToggle}>
            Track {trackTarget ? 'On' : 'Off'}
          </button>

          <button type="button" className={sensorMode ? 'active' : ''} onClick={handleSensorModeToggle}>
            Sensors {sensorMode ? 'On' : 'Off'}
          </button>

          <button type="button" className={audioEnabled ? 'active' : ''} onClick={toggleAudio}>
            Audio {audioEnabled ? 'On' : 'Off'}
          </button>

          <button
            type="button"
            className={workspaceMode === 'split' ? 'active' : ''}
            onClick={handleWorkspaceModeToggle}
          >
            {workspaceMode === 'split' ? 'Split View' : 'Single View'}
          </button>
        </div>

        <div className="intel-layer-row">
          <button
            type="button"
            className={intelLayers.satellites ? 'active' : ''}
            onClick={handleSatellitesToggle}
          >
            Satellites {intelLayers.satellites ? 'On' : 'Off'}
          </button>
          <button
            type="button"
            className={intelLayers.military ? 'active' : ''}
            onClick={handleMilitaryToggle}
          >
            Military {intelLayers.military ? 'On' : 'Off'}
          </button>
          <button
            type="button"
            className={intelLayers.seismic ? 'active' : ''}
            onClick={handleSeismicToggle}
          >
            Seismic {intelLayers.seismic ? 'On' : 'Off'}
          </button>
          <button
            type="button"
            className={intelLayers.cctv ? 'active' : ''}
            onClick={handleCctvToggle}
          >
            CCTV {intelLayers.cctv ? 'On' : 'Off'}
          </button>
          <button
            type="button"
            className={showCountryNames ? 'active' : ''}
            onClick={handleCountryNamesToggle}
          >
            Country Labels {showCountryNames ? 'On' : 'Off'}
          </button>
          <button
            type="button"
            className={intelLayers.streetTraffic ? 'active' : ''}
            onClick={handleStreetTrafficToggle}
          >
            Street {intelLayers.streetTraffic ? 'On' : 'Off'}
          </button>
        </div>

        <div className="visual-skin-row">
          {Object.entries(VISUAL_SKINS).map(([skinId, skinLabel]) => (
            <button
              key={skinId}
              type="button"
              className={visualSkin === skinId ? 'active' : ''}
              onClick={() => handleVisualSkinChange(skinId)}
            >
              {skinLabel}
            </button>
          ))}
        </div>

        <div className="mode-switcher">
          {Object.entries(CAMERA_MODES).map(([modeId, label], index) => (
            <button
              key={modeId}
              type="button"
              className={cameraMode === modeId ? 'active' : ''}
              onClick={() => handleCameraModeChange(modeId)}
              title={`Shortcut ${index + 1}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="playback-panel">
          <div className="playback-actions">
            <button type="button" className={playbackActive ? 'active' : ''} onClick={togglePlaybackMode}>
              {playbackActive ? 'Playback' : 'Live'}
            </button>
            <button type="button" onClick={handlePlaybackToggle} disabled={!playbackActive}>
              {playbackRunning ? 'Pause' : 'Play'}
            </button>
            <button type="button" onClick={gotoLive}>Go Live</button>
            <select
              value={playbackSpeed}
              onChange={(event) => setPlaybackSpeed(Number(event.target.value))}
              disabled={!playbackActive}
            >
              {PLAYBACK_SPEEDS.map((speed) => (
                <option key={speed} value={speed}>{speed}x</option>
              ))}
            </select>
          </div>

          <input
            type="range"
            min={0}
            max={Math.max(0, snapshotHistory.length - 1)}
            value={Math.min(playbackIndex, Math.max(0, snapshotHistory.length - 1))}
            onChange={(event) => {
              setPlaybackActive(true);
              setPlaybackIndex(Number(event.target.value));
            }}
          />

          <div className="playback-meta">
            <span>Snapshots: {snapshotHistory.length}</span>
            <span>
              Cursor UTC: {activeSnapshot ? formatUtcTime(new Date(activeSnapshot.timestamp)) : '---'}
            </span>
          </div>
        </div>

        <div className="operator-footnotes">
          <div>Matches: {matchingCount.toLocaleString()}</div>
          <div>Feed: {dataSource} · Intel: {intelStatus}</div>
          <div>Aircraft Layer: {showAircraft ? 'Visible' : 'Hidden'}</div>
          <div>Render FPS: {metricsView.renderFps || '--'} · Mode: {renderPerformanceMode}{fpsWarning ? ' (performance mode recommended)' : ''}</div>
          <div>{connectionMessage}</div>
          <div>{focusTarget ? `Focus: ${focusTarget.label}` : 'Focus: Flight tracking / manual region view'}</div>
          <div>{terrainConfig.message}</div>
          <div>Shortcuts: 1-4 camera, T track, D density, P playback, S sensors, M workspace, V skin, G satellites, Z seismic, X CCTV</div>
        </div>
      </div>

      <aside className="target-panel">
        <div className="panel-title">Target Feed</div>
        {selectedFlight ? (
          <>
            <div className="target-callsign">{selectedFlight.callsign || 'Unknown'}</div>
            <div className="target-route">
              {selectedFlight.origin || '---'} → {selectedFlight.destination || '---'}
            </div>
            <div className="target-grid">
              <div>
                <span>Airline</span>
                <strong>{selectedFlight.airline || 'Unknown'}</strong>
              </div>
              <div>
                <span>Type</span>
                <strong>{selectedFlight.aircraftType || 'Unknown'}</strong>
              </div>
              <div>
                <span>Profile</span>
                <strong>{selectedFlight.isMilitary ? 'MILITARY' : (selectedFlight.classification || 'civil')}</strong>
              </div>
              <div>
                <span>Altitude</span>
                <strong>{formatAltitude(selectedFlight.altitude)}</strong>
              </div>
              <div>
                <span>Speed</span>
                <strong>{formatSpeed(selectedFlight.speed)}</strong>
              </div>
              <div>
                <span>Heading</span>
                <strong>{Math.round(selectedFlight.heading || 0)}°</strong>
              </div>
              <div>
                <span>Kinematic</span>
                <strong>{Math.round(selectedFlight.kinematicHeading || selectedFlight.heading || 0)}°</strong>
              </div>
              <div>
                <span>Lat</span>
                <strong>{selectedFlight.lat.toFixed(4)}</strong>
              </div>
              <div>
                <span>Lon</span>
                <strong>{selectedFlight.lon.toFixed(4)}</strong>
              </div>
            </div>
            <button
              type="button"
              className={trackTarget ? 'active' : ''}
              onClick={handleFlightTrackToggle}
            >
              {trackTarget ? 'Tracking Locked' : 'Free Camera'}
            </button>
          </>
        ) : (
          <div className="target-empty">
            {showAircraft
              ? 'Select an aircraft to lock target and open telemetry. Tracking view auto-resets if target is lost.'
              : 'Aircraft layer is hidden. Turn Planes back on if you want aircraft targeting and telemetry.'}
          </div>
        )}

        <div className="panel-subtitle">Multi-Intel Layers</div>
        <div className="recording-grid">
          <div>
            <span>Satellites</span>
            <strong>{satelliteTracks.length}</strong>
          </div>
          <div>
            <span>Seismic Events</span>
            <strong>{seismicEvents.length}</strong>
          </div>
          <div>
            <span>CCTV Nodes</span>
            <strong>{cctvNodes.length}</strong>
          </div>
          <div>
            <span>Street Traffic</span>
            <strong>{streetTraffic.length}</strong>
          </div>
        </div>
        <div className="provider-errors">
          <div>Sat feed: {intelSnapshot.sources?.satellites?.source || 'unknown'} · {intelSnapshot.sources?.satellites?.note || 'n/a'}</div>
          <div>Seismic: {intelSnapshot.sources?.seismic?.source || 'unknown'} · {intelSnapshot.sources?.seismic?.note || 'n/a'}</div>
          <div>CCTV: {intelSnapshot.sources?.cctv?.source || 'unknown'} · {intelSnapshot.sources?.cctv?.note || 'n/a'}</div>
          <div>Street: {intelSnapshot.sources?.streetTraffic?.source || 'unknown'} · {intelSnapshot.sources?.streetTraffic?.note || 'n/a'}</div>
        </div>

        <div className="panel-subtitle">CCTV Viewer</div>
        {selectedCctvNode ? (
          <div className="cctv-feed-card">
            <div className="cctv-feed-head">
              <div>
                <strong>{selectedCctvNode.city} CCTV</strong>
                <span>
                  {selectedCctvNode.status} · {selectedCctvNode.source} · {cctvFeedState.feeds.length || selectedCctvNode.feedCount || 0} camera options
                </span>
              </div>
              <button type="button" onClick={() => handleSelectCctv(null)}>Close</button>
            </div>

            {cctvFeedState.status === 'loading' && (
              <div className="target-empty">Resolving public camera feed...</div>
            )}

            {cctvFeedState.status === 'ready' && cctvFeedState.feeds.length > 1 && (
              <div className="cctv-feed-switcher">
                {cctvFeedState.feeds.map((feed) => (
                  <button
                    key={feed.id}
                    type="button"
                    className={cctvFeedState.feed?.id === feed.id ? 'active' : ''}
                    onClick={() => handleCctvFeedSwitch(feed.id)}
                  >
                    {feed.title}
                  </button>
                ))}
              </div>
            )}

            {cctvFeedState.status === 'ready' && cctvFeedState.feed?.embedUrl && (
              <div className="cctv-feed-frame">
                <iframe
                  title={cctvFeedState.feed.title || `${selectedCctvNode.city} CCTV feed`}
                  src={cctvFeedState.feed.embedUrl}
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
            )}

            {cctvFeedState.status === 'ready' && !cctvFeedState.feed?.embedUrl && (
              <div className="cctv-feed-preview-card">
                <strong>{cctvFeedState.feed?.provider || 'External camera provider'}</strong>
                <span>
                  {cctvFeedState.feed?.note || 'This camera has a public source link but does not expose an embeddable player.'}
                </span>
                <span>
                  Open the source feed to view the live camera directly from the provider.
                </span>
              </div>
            )}

            {cctvFeedState.status === 'error' && (
              <div className="target-empty">{cctvFeedState.error}</div>
            )}

            <div className="provider-errors">
              <div>Provider: {cctvFeedState.feed?.provider || 'Unresolved'}</div>
              <div>Mode: {cctvFeedState.feed?.source || 'idle'}</div>
              <div>{cctvFeedState.feed?.note || 'Click a CCTV node on the globe to resolve a public video source.'}</div>
            </div>

            {cctvFeedState.feed?.externalUrl && (
              <a
                className="feed-source-link"
                href={cctvFeedState.feed.externalUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open Camera Source
              </a>
            )}
          </div>
        ) : (
          <div className="target-empty">
            Click a CCTV node on the globe or use the watchlist below to load a public live camera feed.
          </div>
        )}

        <div className="panel-subtitle">City Camera Directory</div>
        {intelLayers.cctv && cctvNodes.length ? (
          <>
            <input
              type="text"
              className="watchlist-filter-input"
              value={cctvDirectoryQuery}
              placeholder="Find city camera"
              onChange={(event) => setCctvDirectoryQuery(event.target.value)}
            />
            <div className="link-list">
              {cctvDirectoryNodes.map((node) => (
                <div key={node.id}>
                  <strong>{node.city} CCTV</strong>
                  <span>
                    {node.status} · {node.source} · {node.feedCount > 0 ? `${node.feedCount} public ${node.feedCount === 1 ? 'feed' : 'feeds'}` : 'public lookup'}
                  </span>
                  <div className="feed-actions-row">
                    <button type="button" onClick={() => focusCctvNode(node)}>Focus</button>
                    <button type="button" onClick={() => handleSelectCctv(node.id)}>Watch</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="target-empty">Enable CCTV to populate the city camera directory.</div>
        )}

        <div className="panel-subtitle">Seismic Watchlist</div>
        {intelLayers.seismic && seismicEvents.length ? (
          <div className="link-list">
            {seismicEvents.slice(0, 4).map((event) => (
              <div key={event.id}>
                <strong>{event.region}</strong>
                <span>M{Number(event.magnitude || 0).toFixed(1)} · {Math.round(event.depthKm || 0)} km depth</span>
                <button type="button" onClick={() => focusSeismicEvent(event)}>Focus</button>
              </div>
            ))}
          </div>
        ) : (
          <div className="target-empty">Enable seismic to populate event focus targets.</div>
        )}

        <div className="panel-subtitle">Track Linking Graph</div>
        {linkedTracks.length ? (
          <div className="link-list">
            {linkedTracks.map((link) => (
              <div key={`${link.targetId}-${link.reason}`}>
                <strong>{link.flight?.callsign || link.targetId}</strong>
                <span>{link.reason} · score {link.score.toFixed(2)} · {Math.round(link.distanceKm)} km</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="target-empty">No linked tracks for current selection.</div>
        )}

        <div className="panel-subtitle">Recording Rules</div>
        <div className="recording-grid">
          <div>
            <span>Rolling Baseline</span>
            <strong>{recordingSummary.rollingCountAvg.toLocaleString()}</strong>
          </div>
          <div>
            <span>Descending Ratio</span>
            <strong>{recordingSummary.descendingRatioPercent}%</strong>
          </div>
          <div>
            <span>Avg Speed</span>
            <strong>{recordingSummary.avgSpeedKnots} kt</strong>
          </div>
          <div>
            <span>FPS</span>
            <strong>{metricsView.renderFps || '--'}</strong>
          </div>
        </div>

        <div className="panel-subtitle">Active Alerts</div>
        <div className="alert-routing">
          <label>
            <input
              type="checkbox"
              checked={alertRouting.hud}
              onChange={(event) => setAlertRouting((p) => ({ ...p, hud: event.target.checked }))}
            /> HUD Route
          </label>
          <label>
            <input
              type="checkbox"
              checked={alertRouting.webhook}
              onChange={(event) => setAlertRouting((p) => ({ ...p, webhook: event.target.checked }))}
            /> Webhook Route
          </label>
        </div>

        <div className="alert-list">
          {activeAlerts.length ? activeAlerts.slice(0, 8).map((alert) => (
            <div key={alert.key} className={`alert-item severity-${alert.severity}`}>
              <div>{alert.rule}</div>
              <span>{alert.message}</span>
            </div>
          )) : <div className="target-empty">No active alerts.</div>}
        </div>

        <div className="panel-subtitle">Notification Log</div>
        <div className="notification-list">
          {notificationLog.length ? notificationLog.slice(0, 6).map((entry) => (
            <div key={entry.id} className={`notify-item severity-${entry.severity}`}>
              <div>{entry.channel}</div>
              <span>{entry.message}</span>
            </div>
          )) : <div className="target-empty">No notifications yet.</div>}
        </div>

        <div className="panel-subtitle">Source Governance</div>
        <div className={`governance-card ${providerGovernance.className || 'governance-neutral'}`}>
          <strong>{providerGovernance.label}</strong>
          <span>{providerGovernance.notes}</span>
          <span>{providerGovernance.usage}</span>
        </div>

        {!!providerErrors.length && (
          <div className="provider-errors">
            {providerErrors.map((entry, index) => (
              <div key={`${entry.provider}-${index}`}>{entry.provider}: {entry.message}</div>
            ))}
          </div>
        )}

        <div className="panel-meta">
          <div>Last update: {lastUpdatedAt ? formatUtcTime(lastUpdatedAt) : '---'}</div>
          <div>Density refresh: every 45 seconds</div>
          <div>Intel cadence: {INTEL_POLL_STARTUP_MS / 1000}s startup / {INTEL_POLL_STEADY_MS / 1000}s steady</div>
          <div>Skin: {VISUAL_SKINS[visualSkin]} · Terrain: {terrainConfig.label}</div>
          <div>Metrics: API {metricsView.apiLatencyMs}ms / Select {metricsView.selectionHitMs}ms / Density {metricsView.densityComputeMs}ms</div>
        </div>
      </aside>

      <div className={`boot-sequence ${booting ? 'active' : 'hidden'}`}>
        <div className="scanline" />
        <div className="boot-copy">
          <div>GOD'S EYE // GLOBAL AIRSPACE SURVEILLANCE</div>
          <div>SYSTEM ONLINE</div>
          <div>SYNCING TELEMETRY STREAM...</div>
        </div>
      </div>
    </div>
  );
}

GodsEyeDashboard.displayName = 'GodsEyeDashboard';

export default React.memo(GodsEyeDashboard);
