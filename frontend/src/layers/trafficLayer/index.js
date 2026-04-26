import { LAYER_IDS } from '../types';

export function createTrafficLayer() {
  return {
    id: LAYER_IDS.traffic,
    name: 'Street Traffic',
    description: 'Urban traffic hotspots from public feed or synthetic generator.',
    enabled: false,
    metadataSchema: ['id', 'lat', 'lon', 'intensity', 'label', 'source'],
    async fetchData(snapshot = {}) {
      return snapshot.streetTraffic || [];
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
