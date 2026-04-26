import { LAYER_IDS } from '../types';

export function createDemoLayer() {
  return {
    id: LAYER_IDS.demo,
    name: 'Demo Signals',
    description: 'Guaranteed local synthetic markers for UI and integration fallback tests.',
    enabled: true,
    metadataSchema: ['id', 'lat', 'lon', 'label', 'severity'],
    async fetchData(nowMs = Date.now()) {
      const drift = (nowMs / 12000) % 1;
      return [
        { id: 'demo-alpha', label: 'Demo Alpha', lat: 37.7749 + drift * 0.4, lon: -122.4194 + drift * 0.3, severity: 'info' },
        { id: 'demo-bravo', label: 'Demo Bravo', lat: 51.5072 - drift * 0.25, lon: -0.1276 + drift * 0.2, severity: 'warn' }
      ];
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
