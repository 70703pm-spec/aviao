import { fetchIntelSnapshot } from '../services/intel';
import { createCctvLayer } from './cctvLayer';
import { createDemoLayer } from './demoLayer';
import { createEarthquakeLayer } from './earthquakeLayer';
import { createFlightLayer } from './flightLayer';
import { createSatelliteLayer } from './satelliteLayer';
import { createTrafficLayer } from './trafficLayer';
import { DEFAULT_LAYER_ENABLED_STATE, LAYER_STATUS } from './types';

const INTEL_LAYER_TO_SNAPSHOT_KEY = {
  satellites: 'satellites',
  traffic: 'streetTraffic',
  cctv: 'cctv',
  earthquakes: 'seismic'
};

function createTelemetry(name, enabled) {
  return {
    name,
    enabled,
    status: LAYER_STATUS.idle,
    count: 0,
    source: 'n/a',
    error: ''
  };
}

export function createWorldviewLayerRegistry() {
  const layers = {
    satellites: createSatelliteLayer(),
    flights: createFlightLayer(),
    traffic: createTrafficLayer(),
    cctv: createCctvLayer(),
    earthquakes: createEarthquakeLayer(),
    demo: createDemoLayer()
  };

  const telemetry = Object.values(layers).reduce((acc, layer) => {
    acc[layer.id] = createTelemetry(layer.name, layer.enabled);
    return acc;
  }, {});

  const enabledState = { ...DEFAULT_LAYER_ENABLED_STATE };

  const setLayerEnabled = (layerId, enabled) => {
    if (!layers[layerId]) {
      return;
    }
    enabledState[layerId] = Boolean(enabled);
    telemetry[layerId] = {
      ...telemetry[layerId],
      enabled: Boolean(enabled)
    };
  };

  const hydrateIntelTelemetry = (snapshot) => {
    Object.entries(INTEL_LAYER_TO_SNAPSHOT_KEY).forEach(([layerId, snapshotKey]) => {
      const layer = layers[layerId];
      const sourceMeta = snapshot?.sources?.[snapshotKey] || {};
      const normalized = layer.normalizeData(snapshot?.[snapshotKey] || []);

      telemetry[layerId] = {
        ...telemetry[layerId],
        enabled: enabledState[layerId],
        count: normalized.length,
        source: sourceMeta.source || 'mock',
        status: sourceMeta.error
          ? LAYER_STATUS.degraded
          : sourceMeta.source === 'live'
            ? LAYER_STATUS.online
            : LAYER_STATUS.mock,
        error: sourceMeta.error || ''
      };
    });
  };

  return {
    layers,
    setLayerEnabled,
    getLayerEnabledState() {
      return { ...enabledState };
    },
    getLayerTelemetry() {
      return { ...telemetry };
    },
    async fetchIntel({ signal } = {}) {
      Object.keys(INTEL_LAYER_TO_SNAPSHOT_KEY).forEach((layerId) => {
        telemetry[layerId] = {
          ...telemetry[layerId],
          status: LAYER_STATUS.loading,
          error: ''
        };
      });

      const snapshot = await fetchIntelSnapshot({ signal });
      hydrateIntelTelemetry(snapshot);

      const demoItems = await layers.demo.fetchData();
      const normalizedDemo = layers.demo.normalizeData(demoItems);
      telemetry.demo = {
        ...telemetry.demo,
        count: normalizedDemo.length,
        source: 'mock',
        status: LAYER_STATUS.mock,
        error: ''
      };

      return {
        ...snapshot,
        demo: normalizedDemo
      };
    },
    updateFlightTelemetry(flights, source = 'mock', error = '') {
      const normalized = layers.flights.normalizeData(flights || []);
      telemetry.flights = {
        ...telemetry.flights,
        enabled: enabledState.flights,
        count: normalized.length,
        source,
        status: error ? LAYER_STATUS.degraded : source === 'mock' ? LAYER_STATUS.mock : LAYER_STATUS.online,
        error
      };
    },
    cleanup() {
      Object.values(layers).forEach((layer) => {
        if (typeof layer.cleanup === 'function') {
          layer.cleanup();
        }
      });
    }
  };
}
