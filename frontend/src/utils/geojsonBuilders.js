import { quantize } from './geo';
import { DENSITY_BUCKET_SIZE_DEG } from '../config/constants';

export function buildDensitySnapshot(flights, bucketSizeDeg = DENSITY_BUCKET_SIZE_DEG) {
  if (!Array.isArray(flights) || !flights.length) {
    return [];
  }

  const bucketMap = new Map();

  flights.forEach((flight) => {
    if (!Number.isFinite(flight.lat) || !Number.isFinite(flight.lon)) {
      return;
    }

    const latKey = quantize(flight.lat + 90, bucketSizeDeg);
    const lonKey = quantize(flight.lon + 180, bucketSizeDeg);
    const key = `${latKey}|${lonKey}`;

    if (!bucketMap.has(key)) {
      bucketMap.set(key, {
        latSum: 0,
        lonSum: 0,
        count: 0,
        militaryCount: 0
      });
    }

    const bucket = bucketMap.get(key);
    bucket.latSum += flight.lat;
    bucket.lonSum += flight.lon;
    bucket.count += 1;
    if (flight.isMilitary) {
      bucket.militaryCount += 1;
    }
  });

  const maxCount = Math.max(
    ...Array.from(bucketMap.values()).map((bucket) => bucket.count),
    1
  );

  return Array.from(bucketMap.values()).map((bucket) => {
    const intensity = Math.min(1, bucket.count / maxCount);
    return {
      lat: bucket.latSum / bucket.count,
      lon: bucket.lonSum / bucket.count,
      count: bucket.count,
      militaryCount: bucket.militaryCount,
      intensity,
      militaryRatio: bucket.count > 0 ? bucket.militaryCount / bucket.count : 0
    };
  });
}

export function buildFlightsGeoJSON(flights) {
  if (!Array.isArray(flights) || !flights.length) {
    return null;
  }

  return {
    type: 'FeatureCollection',
    features: flights
      .filter((flight) => Number.isFinite(flight.lat) && Number.isFinite(flight.lon))
      .map((flight) => ({
        type: 'Feature',
        properties: {
          id: flight.id,
          callsign: flight.callsign,
          airline: flight.airline,
          origin: flight.origin,
          destination: flight.destination,
          altitude: flight.altitude,
          speed: flight.speed,
          heading: flight.heading,
          aircraftType: flight.aircraftType,
          classification: flight.classification,
          military: Boolean(flight.isMilitary)
        },
        geometry: {
          type: 'Point',
          coordinates: [flight.lon, flight.lat]
        }
      }))
  };
}

export function buildDensityGeoJSON(densityCells) {
  if (!Array.isArray(densityCells) || !densityCells.length) {
    return null;
  }

  return {
    type: 'FeatureCollection',
    features: densityCells
      .filter((cell) => Number.isFinite(cell.lat) && Number.isFinite(cell.lon))
      .map((cell, index) => ({
        type: 'Feature',
        properties: {
          id: `density-${index}`,
          count: cell.count,
          intensity: cell.intensity,
          militaryCount: cell.militaryCount,
          militaryRatio: cell.militaryRatio
        },
        geometry: {
          type: 'Point',
          coordinates: [cell.lon, cell.lat]
        }
      }))
  };
}
