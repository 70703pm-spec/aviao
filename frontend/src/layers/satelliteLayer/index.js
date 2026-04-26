import { LAYER_IDS } from '../types';

export function createSatelliteLayer() {
  return {
    id: LAYER_IDS.satellites,
    name: 'Satellites',
    description: 'Orbital objects from public feed or simulated TLE-based fallback.',
    enabled: true,
    metadataSchema: ['id', 'name', 'lat', 'lon', 'altitudeKm', 'velocityKps', 'source'],
    async fetchData(snapshot = {}) {
      return snapshot.satellites || [];
    },
    normalizeData(items = []) {
      return items.filter((item) => Number.isFinite(item?.lat) && Number.isFinite(item?.lon));
    },
    render(items = []) {
      return items;
    },
    update(items = []) {
      return this.normalizeData(items);
    },
    cleanup() {}
  };
}
