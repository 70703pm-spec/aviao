import localPoliticalMap from '../data/world-110m-countries.geojson';

const POLITICAL_MAP_URLS = [
  process.env.REACT_APP_POLITICAL_MAP_URL || '',
  'https://unpkg.com/visionscarto-world-atlas/world/110m_countries.geojson',
  'https://cdn.jsdelivr.net/npm/visionscarto-world-atlas@0.0.5/world/110m_countries.geojson'
].filter(Boolean);

let mapCache = null;
let mapPromise = null;

async function fetchJson(url, signal) {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json'
    },
    signal
  });

  if (!response.ok) {
    throw new Error(`Political map request failed (${response.status})`);
  }

  return response.json();
}

function splitRingOnDateline(ring) {
  const segments = [];
  let current = [];

  ring.forEach((coordinate) => {
    if (!Array.isArray(coordinate) || coordinate.length < 2) {
      return;
    }

    const [lon, lat] = coordinate;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return;
    }

    const point = { lat, lon };
    const previous = current[current.length - 1];

    if (previous && Math.abs(previous.lon - lon) > 180) {
      if (current.length > 1) {
        segments.push(current);
      }
      current = [point];
      return;
    }

    current.push(point);
  });

  if (current.length > 1) {
    segments.push(current);
  }

  return segments;
}

function geometryToPolylines(geometry, featureIndex) {
  if (!geometry) {
    return [];
  }

  const polylineCollections = [];

  if (geometry.type === 'Polygon') {
    if (Array.isArray(geometry.coordinates[0])) {
      polylineCollections.push(geometry.coordinates[0]);
    }
  }

  if (geometry.type === 'MultiPolygon') {
    geometry.coordinates.forEach((polygon) => {
      if (Array.isArray(polygon?.[0])) {
        polylineCollections.push(polygon[0]);
      }
    });
  }

  return polylineCollections.flatMap((ring, ringIndex) => (
    splitRingOnDateline(ring).map((points, segmentIndex) => ({
      id: `political-${featureIndex}-${ringIndex}-${segmentIndex}`,
      importance: 1,
      points
    }))
  ));
}

function payloadToPolylines(payload) {
  const features = payload?.type === 'FeatureCollection'
    ? payload.features
    : payload?.type === 'Feature'
      ? [payload]
      : [];

  return features.flatMap((feature, featureIndex) => (
    geometryToPolylines(feature.geometry, featureIndex)
  ));
}

function ringToPoints(ring) {
  if (!Array.isArray(ring)) {
    return [];
  }

  return ring
    .map((coordinate) => {
      if (!Array.isArray(coordinate) || coordinate.length < 2) {
        return null;
      }

      const [lon, lat] = coordinate;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return null;
      }

      return { lat, lon };
    })
    .filter(Boolean);
}

function geometryToPolygons(geometry, featureIndex) {
  if (!geometry) {
    return [];
  }

  const polygons = [];

  if (geometry.type === 'Polygon' && Array.isArray(geometry.coordinates[0])) {
    polygons.push({
      id: `country-fill-${featureIndex}-0`,
      points: ringToPoints(geometry.coordinates[0])
    });
  }

  if (geometry.type === 'MultiPolygon') {
    geometry.coordinates.forEach((polygon, polygonIndex) => {
      if (Array.isArray(polygon?.[0])) {
        polygons.push({
          id: `country-fill-${featureIndex}-${polygonIndex}`,
          points: ringToPoints(polygon[0])
        });
      }
    });
  }

  return polygons.filter((polygon) => polygon.points.length >= 3);
}

function payloadToPolygons(payload) {
  const features = payload?.type === 'FeatureCollection'
    ? payload.features
    : payload?.type === 'Feature'
      ? [payload]
      : [];

  return features.flatMap((feature, featureIndex) => (
    geometryToPolygons(feature.geometry, featureIndex)
  ));
}

export async function loadPoliticalMapData({ signal } = {}) {
  if (mapCache) {
    return mapCache;
  }

  if (mapPromise) {
    return mapPromise;
  }

  mapPromise = (async () => {
    if (localPoliticalMap) {
      const localBoundaries = payloadToPolylines(localPoliticalMap);
      const localPolygons = payloadToPolygons(localPoliticalMap);

      if (localBoundaries.length && localPolygons.length) {
        mapCache = {
          boundaries: localBoundaries,
          polygons: localPolygons
        };
        return mapCache;
      }
    }

    let lastError = null;

    for (let index = 0; index < POLITICAL_MAP_URLS.length; index += 1) {
      const url = POLITICAL_MAP_URLS[index];

      try {
        const payload = await fetchJson(url, signal);
        const polylines = payloadToPolylines(payload);
        const polygons = payloadToPolygons(payload);

        if (!polylines.length || !polygons.length) {
          throw new Error('Political map payload contained no usable political shapes');
        }

        mapCache = {
          boundaries: polylines,
          polygons
        };
        return mapCache;
      } catch (error) {
        if (signal?.aborted) {
          throw error;
        }
        lastError = error;
      }
    }

    throw lastError || new Error('Unable to load political map boundaries');
  })().catch((error) => {
    mapPromise = null;
    throw error;
  });

  return mapPromise;
}

export async function loadPoliticalBoundaryPolylines({ signal } = {}) {
  const mapData = await loadPoliticalMapData({ signal });
  return mapData.boundaries;
}
