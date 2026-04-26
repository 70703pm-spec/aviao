import { createWorldviewLayerRegistry } from '../layerRegistry';

describe('worldview layer registry', () => {
  it('initializes telemetry and toggles layer states', () => {
    const registry = createWorldviewLayerRegistry();
    const telemetry = registry.getLayerTelemetry();

    expect(telemetry.satellites.name).toBe('Satellites');
    expect(telemetry.traffic.enabled).toBe(false);

    registry.setLayerEnabled('traffic', true);

    expect(registry.getLayerTelemetry().traffic.enabled).toBe(true);
  });

  it('updates flight telemetry status and counts', () => {
    const registry = createWorldviewLayerRegistry();

    registry.updateFlightTelemetry([
      { id: 'f1', lat: 10, lon: 20 },
      { id: 'f2', lat: 11, lon: 21 }
    ], 'opensky');

    const telemetry = registry.getLayerTelemetry();
    expect(telemetry.flights.count).toBe(2);
    expect(telemetry.flights.status).toBe('online');
    expect(telemetry.flights.source).toBe('opensky');
  });
});
