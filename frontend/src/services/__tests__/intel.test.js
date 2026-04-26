import { normalizeCelestrakSatellites } from '../intel';

describe('normalizeCelestrakSatellites', () => {
  it('maps celestrak records to renderable satellites', () => {
    const now = new Date('2026-01-01T00:00:00Z').getTime();
    const items = normalizeCelestrakSatellites([
      {
        noradCatId: '25544',
        objectName: 'ISS (ZARYA)',
        inclination: 51.64,
        meanMotion: 15.5
      }
    ], now);

    expect(items).toHaveLength(1);
    expect(items[0].noradId).toBe('25544');
    expect(Number.isFinite(items[0].lat)).toBe(true);
    expect(Number.isFinite(items[0].lon)).toBe(true);
    expect(Array.isArray(items[0].trail)).toBe(true);
  });
});
