import { LAYER_IDS } from '../types';

export function createFlightLayer() {
  return {
    id: LAYER_IDS.flights,
    name: 'Flights',
    description: 'Commercial and military ADS-B/OpenSky tracks.',
    enabled: true,
    metadataSchema: ['id', 'callsign', 'lat', 'lon', 'altitude', 'speed', 'heading', 'isMilitary'],
    async fetchData(snapshot = {}) {
      return snapshot.flights || [];
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
