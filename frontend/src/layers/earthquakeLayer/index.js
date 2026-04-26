import { LAYER_IDS } from '../types';

export function createEarthquakeLayer() {
  return {
    id: LAYER_IDS.earthquakes,
    name: 'Earthquakes',
    description: 'Seismic events from USGS or synthetic fallback.',
    enabled: false,
    metadataSchema: ['id', 'lat', 'lon', 'magnitude', 'depthKm', 'occurredAt', 'source'],
    async fetchData(snapshot = {}) {
      return snapshot.seismic || [];
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
