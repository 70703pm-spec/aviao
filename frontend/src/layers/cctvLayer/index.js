import { LAYER_IDS } from '../types';

export function createCctvLayer() {
  return {
    id: LAYER_IDS.cctv,
    name: 'CCTV',
    description: 'Public camera nodes with legal curated links and mocked fallback.',
    enabled: true,
    metadataSchema: ['id', 'city', 'lat', 'lon', 'headingDeg', 'fovDeg', 'rangeKm', 'source'],
    async fetchData(snapshot = {}) {
      return snapshot.cctv || [];
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
