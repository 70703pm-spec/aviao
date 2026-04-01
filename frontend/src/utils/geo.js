export const EARTH_RADIUS_KM = 6371;

export const degToRad = (deg) => (deg * Math.PI) / 180;
export const radToDeg = (rad) => (rad * 180) / Math.PI;

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const lerp = (start, end, amount) => start + (end - start) * amount;

export function normalizeLongitude(lon) {
  let value = lon;
  while (value > 180) {
    value -= 360;
  }
  while (value < -180) {
    value += 360;
  }
  return value;
}

export function latLonToCartesian(lat, lon) {
  const latRad = degToRad(lat);
  const lonRad = degToRad(lon);
  const cosLat = Math.cos(latRad);

  return {
    x: cosLat * Math.cos(lonRad),
    y: Math.sin(latRad),
    z: cosLat * Math.sin(lonRad)
  };
}

export function rotateAroundY(vector, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return {
    x: vector.x * cos + vector.z * sin,
    y: vector.y,
    z: -vector.x * sin + vector.z * cos
  };
}

export function rotateAroundX(vector, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return {
    x: vector.x,
    y: vector.y * cos - vector.z * sin,
    z: vector.y * sin + vector.z * cos
  };
}

export function projectPoint(lat, lon, camera, viewport, globeRadius) {
  const cartesian = latLonToCartesian(lat, lon);
  const yaw = degToRad(-camera.centerLon);
  const pitch = degToRad(-camera.centerLat);
  const tilt = degToRad(camera.tiltDeg || 0);

  const yawRotated = rotateAroundY(cartesian, yaw);
  const pitchRotated = rotateAroundX(yawRotated, pitch);
  const tilted = rotateAroundX(pitchRotated, tilt);

  const depth = (tilted.z + 1) * 0.5;
  const perspectiveScale = lerp(0.72, 1.18, depth);

  return {
    visible: tilted.z > -0.06,
    x: viewport.cx + tilted.x * globeRadius * camera.zoom * perspectiveScale,
    y: viewport.cy - tilted.y * globeRadius * camera.zoom * perspectiveScale,
    depth,
    vector: tilted
  };
}

export function haversineDistanceKm(startLat, startLon, endLat, endLon) {
  const lat1 = degToRad(startLat);
  const lat2 = degToRad(endLat);
  const dLat = degToRad(endLat - startLat);
  const dLon = degToRad(endLon - startLon);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

export function destinationPoint(lat, lon, headingDeg, distanceKm) {
  const angularDistance = distanceKm / EARTH_RADIUS_KM;
  const heading = degToRad(headingDeg);
  const lat1 = degToRad(lat);
  const lon1 = degToRad(lon);

  const sinLat1 = Math.sin(lat1);
  const cosLat1 = Math.cos(lat1);
  const sinAd = Math.sin(angularDistance);
  const cosAd = Math.cos(angularDistance);

  const sinLat2 = sinLat1 * cosAd + cosLat1 * sinAd * Math.cos(heading);
  const lat2 = Math.asin(sinLat2);

  const y = Math.sin(heading) * sinAd * cosLat1;
  const x = cosAd - sinLat1 * sinLat2;
  const lon2 = lon1 + Math.atan2(y, x);

  return {
    lat: radToDeg(lat2),
    lon: normalizeLongitude(radToDeg(lon2))
  };
}

export function bearingBetween(startLat, startLon, endLat, endLon) {
  const lat1 = degToRad(startLat);
  const lat2 = degToRad(endLat);
  const dLon = degToRad(endLon - startLon);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  return (radToDeg(Math.atan2(y, x)) + 360) % 360;
}

export function interpolateGreatCircle(startLat, startLon, endLat, endLon, steps) {
  const start = latLonToCartesian(startLat, startLon);
  const end = latLonToCartesian(endLat, endLon);

  const dot = clamp(start.x * end.x + start.y * end.y + start.z * end.z, -1, 1);
  const omega = Math.acos(dot);

  if (omega === 0) {
    return [{ lat: startLat, lon: startLon }, { lat: endLat, lon: endLon }];
  }

  const sinOmega = Math.sin(omega);
  const points = [];

  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const weightStart = Math.sin((1 - t) * omega) / sinOmega;
    const weightEnd = Math.sin(t * omega) / sinOmega;

    const x = start.x * weightStart + end.x * weightEnd;
    const y = start.y * weightStart + end.y * weightEnd;
    const z = start.z * weightStart + end.z * weightEnd;

    const lat = radToDeg(Math.atan2(y, Math.sqrt(x * x + z * z)));
    const lon = radToDeg(Math.atan2(z, x));

    points.push({ lat, lon: normalizeLongitude(lon) });
  }

  return points;
}

export function quantize(value, bucketSize) {
  return Math.floor(value / bucketSize) * bucketSize;
}

export function easeInOutSine(t) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

export function hashStringToUnit(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return (Math.abs(hash) % 1000) / 1000;
}
