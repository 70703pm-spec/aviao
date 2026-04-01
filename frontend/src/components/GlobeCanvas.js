import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  COASTLINE_POLYLINES,
  COUNTRY_DIVISION_POLYLINES,
  CONTINENT_REFERENCE_LABELS,
  COUNTRY_REFERENCE_LABELS,
  REGION_PRESETS
} from '../data/continents';
import { loadPoliticalMapData } from '../services/politicalMap';
import {
  clamp,
  destinationPoint,
  hashStringToUnit,
  interpolateGreatCircle,
  lerp,
  normalizeLongitude,
  projectPoint,
  quantize
} from '../utils/geo';

const MARKER_STRIDE = 9;
const HIT_CELL_SIZE = 58;
const MAX_PIXEL_RATIO = 1.25;

function lerpLongitude(fromLon, toLon, amount) {
  const delta = normalizeLongitude(toLon - fromLon);
  return normalizeLongitude(fromLon + delta * amount);
}

function degradeTier(baseTier, steps) {
  const order = ['ultra-low', 'low', 'medium', 'high'];
  const index = order.indexOf(baseTier);
  if (index === -1) {
    return baseTier;
  }
  return order[Math.max(0, index - steps)];
}

function computeQualityTier(flightCount, mini, performanceMode = 'balanced') {
  if (mini) {
    return 'mini';
  }

  let tier = 'high';
  if (flightCount > 3400) {
    tier = 'ultra-low';
  } else if (flightCount > 2200) {
    tier = 'low';
  } else if (flightCount > 1300) {
    tier = 'medium';
  }

  if (performanceMode === 'ultra') {
    return degradeTier(tier, 2);
  }

  if (performanceMode === 'performance') {
    return degradeTier(tier, 1);
  }

  return tier;
}

function maxFlightsForTier(tier) {
  if (tier === 'ultra-low') {
    return 180;
  }
  if (tier === 'low') {
    return 320;
  }
  if (tier === 'medium') {
    return 560;
  }
  if (tier === 'mini') {
    return 260;
  }
  return 900;
}

function selectFlightsForRender(flights, {
  tier,
  selectedFlightId,
  matchSet,
  hasActiveFilters,
  highlightMilitary
}) {
  const maxCount = maxFlightsForTier(tier);
  if (flights.length <= maxCount) {
    return flights;
  }

  const selected = [];
  const selectedIds = new Set();

  const pushFlight = (flight) => {
    if (!flight || selectedIds.has(flight.id) || selected.length >= maxCount) {
      return;
    }
    selected.push(flight);
    selectedIds.add(flight.id);
  };

  if (selectedFlightId) {
    pushFlight(flights.find((flight) => flight.id === selectedFlightId));
  }

  if (hasActiveFilters) {
    flights.forEach((flight) => {
      if (matchSet.has(flight.id)) {
        pushFlight(flight);
      }
    });
  }

  if (highlightMilitary) {
    flights.forEach((flight) => {
      if (flight.isMilitary) {
        pushFlight(flight);
      }
    });
  }

  const remaining = Math.max(1, maxCount - selected.length);
  const stride = Math.max(1, Math.floor(flights.length / remaining));

  for (let index = 0; index < flights.length && selected.length < maxCount; index += stride) {
    pushFlight(flights[index]);
  }

  for (let index = 0; index < flights.length && selected.length < maxCount; index += 1) {
    pushFlight(flights[index]);
  }

  return selected;
}

function getFlightColor(flight, highlightMilitary) {
  if (highlightMilitary && flight.isMilitary) {
    return [1, 0.44, 0.38];
  }

  if (flight.verticalRate < -1.8) {
    return [0.98, 0.73, 0.24];
  }

  if (flight.altitude < 3500) {
    return [0.36, 0.74, 1];
  }

  if (flight.altitude >= 9000) {
    return [0.94, 0.97, 1];
  }

  return [0.76, 0.9, 1];
}

function heatColor(t) {
  if (t < 0.5) {
    const scaled = t / 0.5;
    return {
      r: lerp(51, 255, scaled),
      g: lerp(155, 178, scaled),
      b: lerp(255, 59, scaled)
    };
  }

  const scaled = (t - 0.5) / 0.5;
  return {
    r: 255,
    g: lerp(178, 69, scaled),
    b: lerp(59, 36, scaled)
  };
}

function drawArrow(ctx, x, y, size, angle, color, alpha, glowEnabled = true) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  if (glowEnabled) {
    ctx.shadowBlur = 8;
    ctx.shadowColor = color;
  } else {
    ctx.shadowBlur = 0;
  }

  ctx.beginPath();
  ctx.moveTo(size * 0.98, 0);
  ctx.lineTo(-size * 0.7, size * 0.55);
  ctx.lineTo(-size * 0.38, 0);
  ctx.lineTo(-size * 0.7, -size * 0.55);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawPath(ctx, points, camera, viewport, globeRadius, strokeStyle, lineWidth, dashed, maxAlpha = 1) {
  let started = false;
  let previousVisible = false;

  ctx.save();
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.globalAlpha = maxAlpha;

  if (dashed) {
    ctx.setLineDash([5, 8]);
  }

  ctx.beginPath();
  points.forEach((point) => {
    const projected = projectPoint(point.lat, point.lon, camera, viewport, globeRadius);

    if (projected.visible) {
      if (!started || !previousVisible) {
        ctx.moveTo(projected.x, projected.y);
      } else {
        ctx.lineTo(projected.x, projected.y);
      }

      started = true;
      previousVisible = true;
    } else {
      previousVisible = false;
    }
  });

  ctx.stroke();
  ctx.restore();
}

function drawLatLonGrid(ctx, camera, viewport, globeRadius, tier = 'high') {
  if (tier === 'ultra-low' || tier === 'low') {
    return;
  }

  const latStep = tier === 'ultra-low' || tier === 'low' ? 30 : tier === 'medium' || tier === 'mini' ? 20 : 15;
  const lonStepForRows = tier === 'ultra-low' || tier === 'low' ? 10 : tier === 'medium' || tier === 'mini' ? 6 : 4;
  const lonColumnStep = tier === 'ultra-low' || tier === 'low' ? 30 : tier === 'mini' ? 20 : 15;
  const latStepForCols = tier === 'ultra-low' || tier === 'low' ? 6 : tier === 'mini' ? 5 : 3;
  const lineAlpha = tier === 'ultra-low' ? 0.04 : 0.08;

  for (let lat = -75; lat <= 75; lat += latStep) {
    const row = [];
    for (let lon = -180; lon <= 180; lon += lonStepForRows) {
      row.push({ lat, lon });
    }
    drawPath(ctx, row, camera, viewport, globeRadius, `rgba(106, 201, 225, ${lineAlpha})`, 0.9, false, 1);
  }

  for (let lon = -180; lon <= 180; lon += lonColumnStep) {
    const column = [];
    for (let lat = -80; lat <= 80; lat += latStepForCols) {
      column.push({ lat, lon });
    }
    drawPath(ctx, column, camera, viewport, globeRadius, `rgba(106, 201, 225, ${lineAlpha})`, 0.9, false, 1);
  }
}

function drawCoastlines(ctx, camera, viewport, globeRadius, tier = 'high') {
  if (tier === 'ultra-low') {
    return;
  }

  const pointStride = tier === 'ultra-low' ? 5 : tier === 'low' ? 3 : tier === 'medium' || tier === 'mini' ? 2 : 1;
  const alpha = tier === 'ultra-low' ? 0.38 : tier === 'low' ? 0.46 : 0.56;
  const strokeWidth = tier === 'ultra-low' ? 1 : tier === 'low' ? 1.15 : 1.35;

  COASTLINE_POLYLINES.forEach((polyline) => {
    const sampledPoints = [];

    for (let index = 0; index < polyline.length; index += pointStride) {
      const [lat, lon] = polyline[index];
      sampledPoints.push({ lat, lon });
    }

    if (polyline.length) {
      const [lat, lon] = polyline[polyline.length - 1];
      const last = sampledPoints[sampledPoints.length - 1];
      if (!last || last.lat !== lat || last.lon !== lon) {
        sampledPoints.push({ lat, lon });
      }
    }

    drawPath(
      ctx,
      sampledPoints,
      camera,
      viewport,
      globeRadius,
      `rgba(108, 226, 247, ${alpha})`,
      strokeWidth,
      false,
      1
    );
  });
}

function drawLandMasses(ctx, camera, viewport, globeRadius, tier = 'high') {
  if (tier === 'ultra-low') {
    return;
  }

  const pointStride = tier === 'low' ? 3 : tier === 'medium' || tier === 'mini' ? 2 : 1;
  const fillAlpha = tier === 'low' ? 0.12 : 0.18;

  ctx.save();
  ctx.fillStyle = `rgba(38, 86, 108, ${fillAlpha})`;

  COASTLINE_POLYLINES.forEach((polyline) => {
    const visiblePoints = [];

    for (let index = 0; index < polyline.length; index += pointStride) {
      const [lat, lon] = polyline[index];
      const projected = projectPoint(lat, lon, camera, viewport, globeRadius);
      if (projected.visible) {
        visiblePoints.push(projected);
      }
    }

    if (visiblePoints.length < 3) {
      return;
    }

    ctx.beginPath();
    ctx.moveTo(visiblePoints[0].x, visiblePoints[0].y);
    for (let index = 1; index < visiblePoints.length; index += 1) {
      ctx.lineTo(visiblePoints[index].x, visiblePoints[index].y);
    }
    ctx.closePath();
    ctx.fill();
  });

  ctx.restore();
}

function drawPoliticalCountryFills(ctx, camera, viewport, globeRadius, tier = 'high', politicalPolygons = []) {
  if (!Array.isArray(politicalPolygons) || !politicalPolygons.length) {
    return;
  }

  const pointStride = tier === 'ultra-low' ? 5 : tier === 'low' ? 3 : tier === 'medium' || tier === 'mini' ? 2 : 1;
  const fillAlpha = tier === 'ultra-low' ? 0.42 : tier === 'low' ? 0.52 : tier === 'medium' || tier === 'mini' ? 0.6 : 0.68;

  ctx.save();
  ctx.fillStyle = `rgba(48, 156, 82, ${fillAlpha})`;

  politicalPolygons.forEach((polygon) => {
    const visiblePoints = [];

    for (let index = 0; index < polygon.points.length; index += pointStride) {
      const point = polygon.points[index];
      if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lon)) {
        continue;
      }

      const projected = projectPoint(point.lat, point.lon, camera, viewport, globeRadius);
      if (projected.visible) {
        visiblePoints.push(projected);
      }
    }

    if (visiblePoints.length < 3) {
      return;
    }

    ctx.beginPath();
    ctx.moveTo(visiblePoints[0].x, visiblePoints[0].y);
    for (let index = 1; index < visiblePoints.length; index += 1) {
      ctx.lineTo(visiblePoints[index].x, visiblePoints[index].y);
    }
    ctx.closePath();
    ctx.fill();
  });

  ctx.restore();
}

function drawCountryDivisions(
  ctx,
  camera,
  viewport,
  globeRadius,
  tier = 'high',
  politicalBoundaryPolylines = []
) {
  const useRemoteBoundaries = Array.isArray(politicalBoundaryPolylines) && politicalBoundaryPolylines.length > 0;
  const minImportance = useRemoteBoundaries
    ? 0
    : tier === 'ultra-low' ? 3 : tier === 'low' ? 2 : tier === 'medium' || tier === 'mini' ? 1 : 0;
  const pointStride = useRemoteBoundaries
    ? tier === 'ultra-low' ? 4 : tier === 'low' ? 3 : tier === 'medium' || tier === 'mini' ? 2 : 1
    : tier === 'ultra-low' ? 3 : tier === 'low' ? 2 : 1;
  const alpha = useRemoteBoundaries
    ? tier === 'ultra-low' ? 0.28 : tier === 'low' ? 0.36 : tier === 'medium' || tier === 'mini' ? 0.44 : 0.56
    : tier === 'ultra-low' ? 0.22 : tier === 'low' ? 0.28 : tier === 'medium' || tier === 'mini' ? 0.34 : 0.4;
  const strokeWidth = useRemoteBoundaries
    ? tier === 'ultra-low' ? 0.8 : tier === 'low' ? 0.95 : tier === 'medium' || tier === 'mini' ? 1.05 : 1.2
    : tier === 'ultra-low' ? 0.7 : tier === 'low' ? 0.8 : 0.95;
  const polylines = useRemoteBoundaries ? politicalBoundaryPolylines : COUNTRY_DIVISION_POLYLINES;

  polylines
    .filter((polyline) => (polyline.importance || 0) >= minImportance)
    .forEach((polyline) => {
      const sampledPoints = [];

      for (let index = 0; index < polyline.points.length; index += pointStride) {
        const point = polyline.points[index];
        if (Array.isArray(point)) {
          const [lat, lon] = point;
          sampledPoints.push({ lat, lon });
        } else if (point && Number.isFinite(point.lat) && Number.isFinite(point.lon)) {
          sampledPoints.push(point);
        }
      }

      if (polyline.points.length) {
        const finalPoint = polyline.points[polyline.points.length - 1];
        const normalizedFinal = Array.isArray(finalPoint)
          ? { lat: finalPoint[0], lon: finalPoint[1] }
          : finalPoint;
        const last = sampledPoints[sampledPoints.length - 1];
        if (
          normalizedFinal &&
          Number.isFinite(normalizedFinal.lat) &&
          Number.isFinite(normalizedFinal.lon) &&
          (!last || last.lat !== normalizedFinal.lat || last.lon !== normalizedFinal.lon)
        ) {
          sampledPoints.push(normalizedFinal);
        }
      }

      if (sampledPoints.length < 2) {
        return;
      }

      drawPath(
        ctx,
        sampledPoints,
        camera,
        viewport,
        globeRadius,
        useRemoteBoundaries
          ? `rgba(224, 243, 232, ${alpha})`
          : `rgba(196, 229, 241, ${alpha})`,
        strokeWidth,
        false,
        1
      );
    });
}

function drawCountryLabels(ctx, camera, viewport, globeRadius, tier = 'high') {
  const continentMax = tier === 'ultra-low' ? 4 : tier === 'low' ? 5 : 7;
  const continentMinImportance = tier === 'ultra-low' ? 2 : 1;
  const maxLabels = tier === 'ultra-low' ? 10 : tier === 'low' ? 16 : tier === 'medium' || tier === 'mini' ? 24 : 36;
  const minImportance = tier === 'ultra-low' ? 2 : tier === 'low' ? 1 : 0;

  const continentLabels = CONTINENT_REFERENCE_LABELS
    .filter((entry) => (entry.importance || 0) >= continentMinImportance)
    .sort((left, right) => (right.importance || 0) - (left.importance || 0))
    .slice(0, continentMax);

  const labels = COUNTRY_REFERENCE_LABELS
    .filter((entry) => (entry.importance || 0) >= minImportance)
    .sort((left, right) => (right.importance || 0) - (left.importance || 0))
    .slice(0, maxLabels);

  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 2;

  continentLabels.forEach((entry) => {
    const projected = projectPoint(entry.lat, entry.lon, camera, viewport, globeRadius);
    if (!projected.visible || projected.depth < 0.08) {
      return;
    }

    const size = tier === 'ultra-low' ? 13 : tier === 'low' ? 14 : 16;
    ctx.font = `600 ${size}px "Space Mono", "JetBrains Mono", monospace`;
    ctx.strokeStyle = 'rgba(0, 18, 32, 0.92)';
    ctx.fillStyle = 'rgba(112, 227, 255, 0.74)';
    ctx.strokeText(entry.name, projected.x, projected.y);
    ctx.fillText(entry.name, projected.x, projected.y);
  });

  labels.forEach((entry) => {
    const projected = projectPoint(entry.lat, entry.lon, camera, viewport, globeRadius);
    if (!projected.visible || projected.depth < 0.08) {
      return;
    }

    const size = tier === 'ultra-low' ? 10 : tier === 'low' ? 11 : tier === 'medium' || tier === 'mini' ? 12 : 13;
    ctx.font = `${size}px "Space Mono", "JetBrains Mono", monospace`;
    ctx.strokeStyle = 'rgba(0, 20, 40, 0.9)';
    ctx.fillStyle = 'rgba(236, 245, 250, 0.96)';
    ctx.strokeText(entry.name, projected.x, projected.y);
    ctx.fillText(entry.name, projected.x, projected.y);
  });

  ctx.restore();
}

function drawBackground(ctx, width, height, starsRef, now) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#01040a');
  gradient.addColorStop(0.35, '#030b16');
  gradient.addColorStop(1, '#010307');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const stars = starsRef.current;
  stars.forEach((star) => {
    const x = star.x * width;
    const y = star.y * height;
    const glow = 0.55 + Math.sin(star.phase + now * star.speed) * 0.3;
    ctx.fillStyle = `rgba(${star.r}, ${star.g}, ${star.b}, ${glow})`;
    ctx.beginPath();
    ctx.arc(x, y, star.size, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawGlobeShell(ctx, viewport, globeRadius, camera) {
  const radius = globeRadius * camera.zoom;
  const sphereGradient = ctx.createRadialGradient(
    viewport.cx - radius * 0.25,
    viewport.cy - radius * 0.27,
    radius * 0.2,
    viewport.cx,
    viewport.cy,
    radius * 1.08
  );

  sphereGradient.addColorStop(0, '#0b2432');
  sphereGradient.addColorStop(0.35, '#0b2e73');
  sphereGradient.addColorStop(0.72, '#081f4f');
  sphereGradient.addColorStop(1, '#041021');

  ctx.fillStyle = sphereGradient;
  ctx.beginPath();
  ctx.arc(viewport.cx, viewport.cy, radius, 0, Math.PI * 2);
  ctx.fill();

  const atmosphere = ctx.createRadialGradient(
    viewport.cx,
    viewport.cy,
    radius,
    viewport.cx,
    viewport.cy,
    radius * 1.22
  );

  atmosphere.addColorStop(0, 'rgba(54, 166, 196, 0.02)');
  atmosphere.addColorStop(0.55, 'rgba(86, 210, 238, 0.17)');
  atmosphere.addColorStop(1, 'rgba(86, 210, 238, 0)');

  ctx.fillStyle = atmosphere;
  ctx.beginPath();
  ctx.arc(viewport.cx, viewport.cy, radius * 1.22, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 0.24;
  ctx.strokeStyle = 'rgba(125, 220, 242, 0.36)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(viewport.cx, viewport.cy, radius + 1.5, 0, Math.PI * 2);
  ctx.stroke();

  return radius;
}

function formatColorTriplet(r, g, b) {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

function drawDensityOverlay(ctx, densityCells, camera, viewport, globeRadius) {
  if (!densityCells.length) {
    return;
  }

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  const maxCells = 360;
  const stride = Math.max(1, Math.floor(densityCells.length / maxCells));

  for (let index = 0; index < densityCells.length; index += stride) {
    const cell = densityCells[index];
    const projection = projectPoint(cell.lat, cell.lon, camera, viewport, globeRadius);
    if (!projection.visible) {
      continue;
    }

    const color = heatColor(cell.intensity);
    const radius = 1.8 + cell.intensity * 12 * (0.3 + projection.depth);

    const glow = ctx.createRadialGradient(
      projection.x,
      projection.y,
      0,
      projection.x,
      projection.y,
      radius
    );

    glow.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, 0.45)`);
    glow.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);

    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(projection.x, projection.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawStreetTrafficOverlay(ctx, trafficNodes, camera, viewport, globeRadius, tier = 'high') {
  if (!trafficNodes.length) {
    return;
  }

  const maxNodes = tier === 'ultra-low' ? 120 : tier === 'low' ? 180 : tier === 'medium' || tier === 'mini' ? 260 : 360;
  const nodeStride = Math.max(1, Math.floor(trafficNodes.length / maxNodes));

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  for (let index = 0; index < trafficNodes.length; index += nodeStride) {
    const node = trafficNodes[index];
    const projection = projectPoint(node.lat, node.lon, camera, viewport, globeRadius);
    if (!projection.visible) {
      continue;
    }

    const color = heatColor(node.intensity || 0);
    const radius = 2 + (node.intensity || 0) * 9 * (0.3 + projection.depth);
    const glow = ctx.createRadialGradient(
      projection.x,
      projection.y,
      0,
      projection.x,
      projection.y,
      radius
    );

    glow.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, 0.52)`);
    glow.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);

    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(projection.x, projection.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawSeismicEvents(ctx, seismicEvents, camera, viewport, globeRadius, now, tier = 'high') {
  if (!seismicEvents.length) {
    return;
  }

  const maxEvents = tier === 'ultra-low' ? 12 : tier === 'low' ? 24 : tier === 'mini' ? 30 : 48;
  const eventStride = Math.max(1, Math.floor(seismicEvents.length / maxEvents));

  ctx.save();

  for (let index = 0; index < seismicEvents.length; index += eventStride) {
    const event = seismicEvents[index];
    const projection = projectPoint(event.lat, event.lon, camera, viewport, globeRadius);
    if (!projection.visible) {
      continue;
    }

    const magnitude = Number.isFinite(event.magnitude) ? event.magnitude : 0;
    const pulse = (Math.sin(now * 0.004 + index) + 1) / 2;
    const radius = 3 + magnitude * 1.25 + pulse * 6;
    const alpha = 0.22 + Math.min(0.5, magnitude / 12);

    ctx.strokeStyle = `rgba(252, 141, 90, ${alpha})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(projection.x, projection.y, radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = `rgba(255, 216, 181, ${alpha * 0.75})`;
    ctx.beginPath();
    ctx.arc(projection.x, projection.y, radius + 5.5, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawCctvNodes(ctx, nodes, camera, viewport, globeRadius, now, tier = 'high') {
  if (!nodes.length) {
    return;
  }

  const maxNodes = tier === 'ultra-low' ? 80 : tier === 'low' ? 140 : tier === 'medium' || tier === 'mini' ? 220 : 320;
  const nodeStride = Math.max(1, Math.floor(nodes.length / maxNodes));

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  for (let index = 0; index < nodes.length; index += nodeStride) {
    const node = nodes[index];
    const projection = projectPoint(node.lat, node.lon, camera, viewport, globeRadius);
    if (!projection.visible) {
      continue;
    }

    const online = node.status !== 'offline';
    const pulse = 0.8 + (Math.sin(now * 0.005 + index * 0.5) + 1) * 0.18;
    const radius = online ? 3.4 * pulse : 2.3;

    const glow = ctx.createRadialGradient(
      projection.x,
      projection.y,
      0,
      projection.x,
      projection.y,
      radius * 3.2
    );

    glow.addColorStop(0, online ? 'rgba(104, 230, 255, 0.46)' : 'rgba(120, 144, 164, 0.24)');
    glow.addColorStop(1, 'rgba(104, 230, 255, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(projection.x, projection.y, radius * 3.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = online ? 'rgba(104, 230, 255, 0.88)' : 'rgba(118, 138, 154, 0.8)';
    ctx.beginPath();
    ctx.arc(projection.x, projection.y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = online ? 'rgba(214, 248, 255, 0.7)' : 'rgba(158, 171, 186, 0.5)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(projection.x, projection.y, radius + 1.8, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawSatelliteLayer(ctx, satellites, camera, viewport, globeRadius, tier = 'high') {
  if (!satellites.length) {
    return;
  }

  const maxSatellites = tier === 'ultra-low' ? 40 : tier === 'low' ? 60 : tier === 'medium' || tier === 'mini' ? 90 : 160;
  const satStride = Math.max(1, Math.floor(satellites.length / maxSatellites));
  const showLabels = tier === 'high';

  ctx.save();

  for (let index = 0; index < satellites.length; index += satStride) {
    const satellite = satellites[index];
    if (Array.isArray(satellite.trail) && satellite.trail.length >= 2) {
      drawPath(
        ctx,
        satellite.trail,
        camera,
        viewport,
        globeRadius,
        'rgba(139, 236, 255, 0.3)',
        0.9,
        true,
        0.7
      );
    }

    const projection = projectPoint(satellite.lat, satellite.lon, camera, viewport, globeRadius);
    if (!projection.visible) {
      continue;
    }

    const size = clamp(2.7 + projection.depth * 2.2, 2.4, 6.3);
    const color = satellite.status === 'relay'
      ? 'rgba(255, 196, 129, 0.9)'
      : 'rgba(142, 244, 255, 0.9)';

    ctx.save();
    ctx.translate(projection.x, projection.y);
    ctx.rotate((satellite.heading || 0) * (Math.PI / 180));
    ctx.fillStyle = color;
    ctx.shadowBlur = 9;
    ctx.shadowColor = color;
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(0, size * 0.72);
    ctx.lineTo(-size, 0);
    ctx.lineTo(0, -size * 0.72);
    ctx.closePath();
    ctx.fill();

    if (showLabels && index < 5) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(196, 241, 255, 0.88)';
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.textBaseline = 'bottom';
      ctx.fillText(satellite.name || satellite.id || 'SAT', size + 5, -2);
    }

    ctx.restore();
  }

  ctx.restore();
}

function applyVisualSkin(ctx, width, height, visualSkin, now, tier = 'high') {
  if (!visualSkin || visualSkin === 'default') {
    return;
  }

  if (visualSkin === 'crt') {
    const scanStep = tier === 'ultra-low' || tier === 'low' ? 6 : tier === 'mini' ? 5 : 3;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = 'rgba(101, 196, 255, 0.08)';
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'source-over';

    for (let y = 0; y < height; y += scanStep) {
      const alpha = 0.03 + ((y / scanStep) % 2) * 0.025;
      ctx.fillStyle = `rgba(12, 24, 38, ${alpha})`;
      ctx.fillRect(0, y, width, 1);
    }

    const jitter = Math.sin(now * 0.0023) * 1.2;
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#9ed4ff';
    ctx.fillRect(jitter, 0, width, height);
    ctx.restore();
    return;
  }

  if (visualSkin === 'nightVision') {
    const scanStep = tier === 'ultra-low' || tier === 'low' ? 8 : tier === 'mini' ? 6 : 4;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = 'rgba(102, 255, 135, 0.2)';
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgba(10, 45, 15, 0.42)';
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'source-over';
    for (let y = 0; y < height; y += scanStep) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
      ctx.fillRect(0, y, width, 1);
    }
    ctx.restore();
    return;
  }

  if (visualSkin === 'flir') {
    const thermalGradient = ctx.createLinearGradient(0, 0, width, height);
    thermalGradient.addColorStop(0, 'rgba(43, 69, 255, 0.16)');
    thermalGradient.addColorStop(0.35, 'rgba(78, 195, 255, 0.13)');
    thermalGradient.addColorStop(0.65, 'rgba(247, 156, 72, 0.18)');
    thermalGradient.addColorStop(1, 'rgba(255, 80, 52, 0.22)');

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = thermalGradient;
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgba(16, 17, 31, 0.3)';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
}

function drawSensorVolume(ctx, sensor, camera, viewport, globeRadius, nowMs, tier = 'high') {
  const center = projectPoint(sensor.lat, sensor.lon, camera, viewport, globeRadius);
  if (!center.visible) {
    return;
  }

  const points = [];
  const segments = tier === 'ultra-low' ? 6 : tier === 'low' ? 10 : tier === 'medium' || tier === 'mini' ? 14 : 20;
  const startBearing = sensor.headingDeg - sensor.arcDeg / 2;
  const endBearing = sensor.headingDeg + sensor.arcDeg / 2;

  for (let segment = 0; segment <= segments; segment += 1) {
    const ratio = segment / segments;
    const bearing = startBearing + (endBearing - startBearing) * ratio;
    const edgeGeo = destinationPoint(sensor.lat, sensor.lon, bearing, sensor.radiusKm);
    const edgeProjection = projectPoint(edgeGeo.lat, edgeGeo.lon, camera, viewport, globeRadius);

    if (edgeProjection.visible) {
      points.push({ x: edgeProjection.x, y: edgeProjection.y });
    }
  }

  if (points.length < 2) {
    return;
  }

  ctx.save();
  ctx.globalAlpha = 0.72;
  ctx.fillStyle = sensor.fill || 'rgba(95, 222, 255, 0.12)';
  ctx.strokeStyle = sensor.stroke || 'rgba(120, 235, 255, 0.4)';
  ctx.lineWidth = 1;

  ctx.beginPath();
  ctx.moveTo(center.x, center.y);
  points.forEach((point) => {
    ctx.lineTo(point.x, point.y);
  });
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = sensor.stroke || 'rgba(120, 235, 255, 0.4)';
  ctx.setLineDash([4, 6]);
  ctx.lineDashOffset = -(nowMs * 0.03) % 100;

  ctx.beginPath();
  ctx.moveTo(center.x, center.y);
  points.forEach((point) => {
    ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();

  ctx.restore();
}

function drawLinkEdges(ctx, linkEdges, projectedById) {
  if (!linkEdges.length) {
    return;
  }

  ctx.save();
  ctx.lineWidth = 1;

  linkEdges.forEach((edge) => {
    const from = projectedById.get(edge.from);
    const to = projectedById.get(edge.to);

    if (!from || !to || !from.visible || !to.visible) {
      return;
    }

    const alpha = edge.reason === 'callsign' ? 0.55 : 0.32;
    ctx.strokeStyle = edge.reason === 'callsign'
      ? `rgba(255, 210, 124, ${alpha})`
      : `rgba(128, 203, 226, ${alpha})`;

    ctx.setLineDash(edge.reason === 'callsign' ? [] : [3, 5]);
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  });

  ctx.restore();
}

function buildProjectedHeadingAngle(flight, camera) {
  const heading = Number.isFinite(flight.kinematicHeading) ? flight.kinematicHeading : flight.heading;
  const headingDeg = Number.isFinite(heading) ? heading : 0;
  const centerLon = Number.isFinite(camera.centerLon) ? normalizeLongitude(camera.centerLon) : 0;
  const deltaDeg = normalizeLongitude(headingDeg - centerLon);
  return (deltaDeg * Math.PI) / 180;
}

function buildPredictionPath(flight) {
  if (Number.isFinite(flight.destinationLat) && Number.isFinite(flight.destinationLon)) {
    return interpolateGreatCircle(flight.lat, flight.lon, flight.destinationLat, flight.destinationLon, 48);
  }

  const speedKmh = (flight.speed || 0) * 3.6;
  const predictionDistanceKm = clamp((speedKmh / 60) * 18, 120, 1500);
  const points = [];

  for (let segment = 0; segment <= 16; segment += 1) {
    const traveled = (predictionDistanceKm / 16) * segment;
    points.push(destinationPoint(flight.lat, flight.lon, flight.heading || 0, traveled));
  }

  return points;
}

function buildCameraFocus(lat, lon, zoom = null, tiltDeg = null) {
  const appliedTilt = Number.isFinite(tiltDeg) ? tiltDeg : 0;

  return {
    centerLat: clamp(appliedTilt - lat, -72, 72),
    centerLon: normalizeLongitude(90 - lon),
    zoom,
    tiltDeg
  };
}

function shouldFollowTarget(mode, trackTarget) {
  return (mode === 'chase' || mode === 'region') && trackTarget;
}

function GlobeCanvas({
  flights,
  densityMode,
  densitySnapshot,
  satellites = [],
  seismicEvents = [],
  cctvNodes = [],
  streetTraffic = [],
  visualSkin = 'default',
  highlightMilitary = true,
  performanceMode = 'balanced',
  showAircraft = true,
  selectedFlightId,
  selectedCctvId = null,
  onSelectFlight,
  onSelectCctv,
  cameraMode,
  cameraRegion,
  matchSet,
  hasActiveFilters,
  trackTarget,
  showCountryNames = true,
  sensorMode = false,
  sensorVolumes = [],
  linkEdges = [],
  onRenderFps,
  onSelectionHit,
  mini = false,
  focusTarget = null,
  staticView = null,
  disableSelection = false
}) {
  const canvasRef = useRef(null);
  const animationFrameRef = useRef(0);
  const contextRef = useRef(null);
  const markerBufferRef = useRef(new Float32Array(0));
  const markerLookupRef = useRef(new Map());
  const hitGridRef = useRef(new Map());
  const fpsRef = useRef({ frameCount: 0, startMs: performance.now() });
  const pixelRatioRef = useRef(1);
  const onSelectFlightRef = useRef(onSelectFlight);
  const onSelectCctvRef = useRef(onSelectCctv);
  const onSelectionHitRef = useRef(onSelectionHit);
  const onRenderFpsRef = useRef(onRenderFps);
  const appliedFocusRef = useRef(null);
  const [politicalMap, setPoliticalMap] = useState({
    boundaries: [],
    polygons: []
  });

  const dragRef = useRef({
    dragging: false,
    pointerId: null,
    moved: false,
    startX: 0,
    startY: 0,
    centerLat: 12,
    centerLon: 0
  });

  const cameraRef = useRef({
    centerLat: staticView?.centerLat || 18,
    centerLon: staticView?.centerLon || 0,
    zoom: staticView?.zoom || 0.95,
    tiltDeg: staticView?.tiltDeg || 16,
    userInteractingUntil: 0
  });

  const starsRef = useRef([]);

  const selectedFlight = useMemo(
    () => (showAircraft ? flights.find((flight) => flight.id === selectedFlightId) || null : null),
    [flights, selectedFlightId, showAircraft]
  );

  const selectedPredictionPath = useMemo(
    () => (showAircraft && selectedFlight ? buildPredictionPath(selectedFlight) : null),
    [selectedFlight, showAircraft]
  );

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    loadPoliticalMapData({ signal: controller.signal })
      .then((mapData) => {
        if (active) {
          setPoliticalMap(mapData);
        }
      })
      .catch(() => {});

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const qualityTier = useMemo(
    () => computeQualityTier(flights.length, mini, performanceMode),
    [flights.length, mini, performanceMode]
  );

  const renderFlights = useMemo(
    () => (showAircraft ? selectFlightsForRender(flights, {
      tier: qualityTier,
      selectedFlightId,
      matchSet,
      hasActiveFilters,
      highlightMilitary
    }) : []),
    [flights, qualityTier, selectedFlightId, matchSet, hasActiveFilters, highlightMilitary, showAircraft]
  );

  useEffect(() => {
    onSelectFlightRef.current = onSelectFlight;
  }, [onSelectFlight]);

  useEffect(() => {
    onSelectCctvRef.current = onSelectCctv;
  }, [onSelectCctv]);

  useEffect(() => {
    onSelectionHitRef.current = onSelectionHit;
  }, [onSelectionHit]);

  useEffect(() => {
    onRenderFpsRef.current = onRenderFps;
  }, [onRenderFps]);

  useEffect(() => {
    const starCount = mini
      ? 100
      : performanceMode === 'ultra'
        ? 80
        : performanceMode === 'performance'
          ? 130
          : 220;

    starsRef.current = Array.from({ length: starCount }, () => ({
      x: Math.random(),
      y: Math.random(),
      size: Math.random() * (mini ? 1.1 : 1.6) + 0.25,
      speed: Math.random() * 0.0012 + 0.0005,
      phase: Math.random() * Math.PI * 2,
      r: Math.floor(176 + Math.random() * 66),
      g: Math.floor(188 + Math.random() * 62),
      b: Math.floor(210 + Math.random() * 45)
    }));
  }, [mini, performanceMode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return () => {};
    }

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const modeCap = performanceMode === 'ultra' ? 0.62 : performanceMode === 'performance' ? 0.82 : MAX_PIXEL_RATIO;
      const pixelRatio = Math.max(0.5, Math.min(window.devicePixelRatio || 1, modeCap));
      pixelRatioRef.current = pixelRatio;
      canvas.width = Math.max(1, Math.floor(rect.width * pixelRatio));
      canvas.height = Math.max(1, Math.floor(rect.height * pixelRatio));
    };

    resizeCanvas();

    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(canvas);

    return () => {
      observer.disconnect();
    };
  }, [performanceMode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const interactive = !mini && !disableSelection;

    if (!canvas || !interactive) {
      return () => {};
    }

    const pointerDown = (event) => {
      if (event.button !== 0) {
        return;
      }

      dragRef.current.dragging = true;
      dragRef.current.pointerId = event.pointerId;
      dragRef.current.moved = false;
      dragRef.current.startX = event.clientX;
      dragRef.current.startY = event.clientY;
      dragRef.current.centerLat = cameraRef.current.centerLat;
      dragRef.current.centerLon = cameraRef.current.centerLon;
    };

    const pointerMove = (event) => {
      const drag = dragRef.current;
      if (!drag.dragging || (drag.pointerId !== null && event.pointerId !== drag.pointerId)) {
        return;
      }

      const camera = cameraRef.current;
      const deltaX = event.clientX - drag.startX;
      const deltaY = event.clientY - drag.startY;
      if (!drag.moved && Math.hypot(deltaX, deltaY) > 3) {
        drag.moved = true;
        camera.userInteractingUntil = performance.now() + 3500;
      }
      const scale = 0.12 / camera.zoom;

      camera.centerLon = normalizeLongitude(drag.centerLon - deltaX * scale);
      camera.centerLat = clamp(drag.centerLat + deltaY * scale, -72, 72);
      if (drag.moved) {
        camera.userInteractingUntil = performance.now() + 3500;
      }
    };

    const pointerUp = (event) => {
      const drag = dragRef.current;
      if (drag.pointerId !== null && event.pointerId !== drag.pointerId) {
        return;
      }
      drag.dragging = false;
      drag.pointerId = null;
    };

    const wheel = (event) => {
      event.preventDefault();
      const camera = cameraRef.current;
      const zoomDelta = event.deltaY > 0 ? -0.08 : 0.08;
      camera.zoom = clamp(camera.zoom + zoomDelta, 0.72, 2.5);
      camera.userInteractingUntil = performance.now() + 3500;
    };

    const click = (event) => {
      if (dragRef.current.moved) {
        dragRef.current.moved = false;
        return;
      }

      const hitStart = performance.now();
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      const cellX = quantize(x, HIT_CELL_SIZE);
      const cellY = quantize(y, HIT_CELL_SIZE);
      const grid = hitGridRef.current;

      let best = null;
      let bestDistance = Number.POSITIVE_INFINITY;

      for (let offsetX = -HIT_CELL_SIZE; offsetX <= HIT_CELL_SIZE; offsetX += HIT_CELL_SIZE) {
        for (let offsetY = -HIT_CELL_SIZE; offsetY <= HIT_CELL_SIZE; offsetY += HIT_CELL_SIZE) {
          const key = `${cellX + offsetX}|${cellY + offsetY}`;
          const bucket = grid.get(key);
          if (!bucket) {
            continue;
          }

          for (let index = 0; index < bucket.length; index += 1) {
            const entry = bucket[index];
            const distance = Math.hypot(entry.x - x, entry.y - y);
            if (distance <= entry.hitRadius && distance < bestDistance) {
              bestDistance = distance;
              best = entry;
            }
          }
        }
      }

      if (best?.kind === 'cctv') {
        cameraRef.current.userInteractingUntil = 0;
        if (typeof onSelectFlightRef.current === 'function') {
          onSelectFlightRef.current(null);
        }
        if (typeof onSelectCctvRef.current === 'function') {
          onSelectCctvRef.current(best.id);
        }
      } else if (best?.kind === 'flight') {
        cameraRef.current.userInteractingUntil = 0;
        if (typeof onSelectCctvRef.current === 'function') {
          onSelectCctvRef.current(null);
        }
        if (typeof onSelectFlightRef.current === 'function') {
          onSelectFlightRef.current(best.id);
        }
      } else {
        if (typeof onSelectFlightRef.current === 'function') {
          onSelectFlightRef.current(null);
        }
        if (typeof onSelectCctvRef.current === 'function') {
          onSelectCctvRef.current(null);
        }
      }

      if (typeof onSelectionHitRef.current === 'function') {
        onSelectionHitRef.current(performance.now() - hitStart);
      }
    };

    canvas.addEventListener('pointerdown', pointerDown);
    window.addEventListener('pointermove', pointerMove);
    window.addEventListener('pointerup', pointerUp);
    canvas.addEventListener('wheel', wheel, { passive: false });
    canvas.addEventListener('click', click);

    return () => {
      canvas.removeEventListener('pointerdown', pointerDown);
      window.removeEventListener('pointermove', pointerMove);
      window.removeEventListener('pointerup', pointerUp);
      canvas.removeEventListener('wheel', wheel);
      canvas.removeEventListener('click', click);
    };
  }, [mini, disableSelection]);

  useEffect(() => {
    const renderFrame = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      const now = performance.now();
      let context = contextRef.current;
      if (!context) {
        context = canvas.getContext('2d');
        contextRef.current = context;
      }
      if (!context) {
        return;
      }

      const pixelRatio = pixelRatioRef.current || 1;
      const width = canvas.width / pixelRatio;
      const height = canvas.height / pixelRatio;

      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      drawBackground(context, width, height, starsRef, now);

      const viewport = {
        cx: width * 0.5,
        cy: height * (mini ? 0.5 : 0.525)
      };

      const globeRadius = Math.min(width, height) * (mini ? 0.36 : 0.33);
      const camera = cameraRef.current;
      const interactionLocked = now < camera.userInteractingUntil;

      const mode = staticView?.cameraMode || cameraMode;
      const regionId = staticView?.cameraRegion || cameraRegion;
      const regionPreset = REGION_PRESETS[regionId] || REGION_PRESETS.global;

      if (mode === 'overview' && !interactionLocked && !focusTarget) {
        camera.centerLat = lerp(camera.centerLat, REGION_PRESETS.global.centerLat, 0.015);
        camera.centerLon = normalizeLongitude(camera.centerLon + (mini ? 0.02 : 0.035));
        camera.zoom = lerp(camera.zoom, mini ? 0.88 : REGION_PRESETS.global.zoom, 0.024);
        camera.tiltDeg = lerp(camera.tiltDeg, mini ? 10 : REGION_PRESETS.global.tilt, 0.035);
      }

      if (mode === 'region' && !interactionLocked && !focusTarget) {
        camera.centerLat = lerp(camera.centerLat, regionPreset.centerLat, 0.03);
        camera.centerLon = lerpLongitude(camera.centerLon, regionPreset.centerLon, 0.03);
        camera.zoom = lerp(camera.zoom, regionPreset.zoom, 0.03);
        camera.tiltDeg = lerp(camera.tiltDeg, regionPreset.tilt, 0.03);
      }

      if (mode === 'sweep' && !interactionLocked && !focusTarget) {
        const sweepLon = regionPreset.centerLon + Math.sin(now * 0.0002) * 42;
        const sweepLat = regionPreset.centerLat + Math.sin(now * 0.00014) * 7;
        camera.centerLon = lerpLongitude(camera.centerLon, sweepLon, 0.02);
        camera.centerLat = lerp(camera.centerLat, sweepLat, 0.02);
        camera.zoom = lerp(camera.zoom, clamp(regionPreset.zoom - 0.15, 0.9, 1.8), 0.02);
        camera.tiltDeg = lerp(camera.tiltDeg, clamp(regionPreset.tilt + 2, 16, 34), 0.02);
      }

      if (mode === 'chase' && !interactionLocked) {
        const chaseZoom = qualityTier === 'ultra-low' || qualityTier === 'low'
          ? 1.45
          : qualityTier === 'medium' || qualityTier === 'mini'
            ? 1.56
            : 1.68;
        const chaseTilt = qualityTier === 'ultra-low' || qualityTier === 'low' ? 22 : 25;
        camera.zoom = lerp(camera.zoom, chaseZoom, 0.03);
        camera.tiltDeg = lerp(camera.tiltDeg, chaseTilt, 0.04);
      }

      if (staticView && Number.isFinite(staticView.centerLat)) {
        camera.centerLat = lerp(camera.centerLat, staticView.centerLat, 0.05);
      }
      if (staticView && Number.isFinite(staticView.centerLon)) {
        camera.centerLon = lerpLongitude(camera.centerLon, staticView.centerLon, 0.05);
      }
      if (staticView && Number.isFinite(staticView.zoom)) {
        camera.zoom = lerp(camera.zoom, staticView.zoom, 0.05);
      }
      if (staticView && Number.isFinite(staticView.tiltDeg)) {
        camera.tiltDeg = lerp(camera.tiltDeg, staticView.tiltDeg, 0.05);
      }

      if (
        focusTarget &&
        !selectedFlight &&
        !staticView &&
        !interactionLocked &&
        appliedFocusRef.current !== focusTarget.id
      ) {
        const desiredFocus = buildCameraFocus(
          focusTarget.lat,
          focusTarget.lon,
          focusTarget.zoom || 1.58,
          focusTarget.tiltDeg || 20
        );

        camera.centerLat = lerp(camera.centerLat, desiredFocus.centerLat, 0.11);
        camera.centerLon = lerpLongitude(camera.centerLon, desiredFocus.centerLon, 0.11);
        camera.zoom = lerp(camera.zoom, desiredFocus.zoom, 0.08);
        camera.tiltDeg = lerp(camera.tiltDeg, desiredFocus.tiltDeg, 0.08);

        const centered =
          Math.abs(camera.centerLat - desiredFocus.centerLat) < 0.35 &&
          Math.abs(normalizeLongitude(camera.centerLon - desiredFocus.centerLon)) < 0.5 &&
          Math.abs(camera.zoom - desiredFocus.zoom) < 0.05 &&
          Math.abs(camera.tiltDeg - desiredFocus.tiltDeg) < 0.6;

        if (centered) {
          appliedFocusRef.current = focusTarget.id;
        }
      }

      if (showAircraft && selectedFlight && shouldFollowTarget(mode, trackTarget) && !staticView) {
        const desiredFocus = buildCameraFocus(selectedFlight.lat, selectedFlight.lon, null, camera.tiltDeg);
        camera.centerLat = lerp(camera.centerLat, desiredFocus.centerLat, 0.12);
        camera.centerLon = lerpLongitude(camera.centerLon, desiredFocus.centerLon, 0.12);
      }

      camera.centerLon = normalizeLongitude(camera.centerLon);

      context.save();
      const effectiveRadius = drawGlobeShell(context, viewport, globeRadius, camera);

      context.beginPath();
      context.arc(viewport.cx, viewport.cy, effectiveRadius, 0, Math.PI * 2);
      context.clip();

      drawLatLonGrid(context, camera, viewport, globeRadius, qualityTier);
      if (politicalMap.polygons.length) {
        drawPoliticalCountryFills(context, camera, viewport, globeRadius, qualityTier, politicalMap.polygons);
      } else {
        drawLandMasses(context, camera, viewport, globeRadius, qualityTier);
      }
      drawCoastlines(context, camera, viewport, globeRadius, qualityTier);
      drawCountryDivisions(context, camera, viewport, globeRadius, qualityTier, politicalMap.boundaries);
      if (showCountryNames) {
        drawCountryLabels(context, camera, viewport, globeRadius, qualityTier);
      }

      if (densityMode && qualityTier !== 'ultra-low') {
        drawDensityOverlay(context, densitySnapshot, camera, viewport, globeRadius);
      }

      if (streetTraffic.length && qualityTier !== 'ultra-low') {
        drawStreetTrafficOverlay(context, streetTraffic, camera, viewport, globeRadius, qualityTier);
      }

      if (seismicEvents.length) {
        drawSeismicEvents(context, seismicEvents, camera, viewport, globeRadius, now, qualityTier);
      }

      if (cctvNodes.length) {
        drawCctvNodes(context, cctvNodes, camera, viewport, globeRadius, now, qualityTier);
      }

      if (satellites.length) {
        drawSatelliteLayer(context, satellites, camera, viewport, globeRadius, qualityTier);
      }

      if (sensorMode && sensorVolumes.length) {
        sensorVolumes.forEach((sensor) => (
          drawSensorVolume(context, sensor, camera, viewport, globeRadius, now, qualityTier)
        ));
      }

      const trailOpacityScale = hasActiveFilters ? 0.8 : 0.56;
      const trailStride = qualityTier === 'low' ? 5 : qualityTier === 'medium' || qualityTier === 'mini' ? 2 : 1;
      const maxTrails = showAircraft
        ? qualityTier === 'ultra-low' ? 0 : qualityTier === 'low' ? 48 : qualityTier === 'medium' || qualityTier === 'mini' ? 180 : 320
        : 0;

      if (showAircraft && maxTrails > 0) {
        let drawnTrails = 0;

        for (let flightIndex = 0; flightIndex < renderFlights.length; flightIndex += trailStride) {
          const flight = renderFlights[flightIndex];
          if (drawnTrails >= maxTrails) {
            break;
          }

          if (!Array.isArray(flight.trail) || flight.trail.length < 2) {
            continue;
          }

          const isMatch = !hasActiveFilters || matchSet.has(flight.id);
          drawPath(
            context,
            flight.trail,
            camera,
            viewport,
            globeRadius,
            isMatch ? 'rgba(122, 214, 248, 0.38)' : 'rgba(91, 121, 138, 0.12)',
            isMatch ? 1.3 : 0.9,
            false,
            isMatch ? trailOpacityScale : 0.28
          );
          drawnTrails += 1;
        }
      }

      if (selectedPredictionPath) {
        context.save();
        context.setLineDash([6, 7]);
        context.lineDashOffset = -(now * 0.02) % 80;
        drawPath(
          context,
          selectedPredictionPath,
          camera,
          viewport,
          globeRadius,
          'rgba(120, 228, 255, 0.64)',
          1.4,
          true,
          0.95
        );
        context.restore();
      }

      const hitGrid = new Map();
      const projectedById = new Map();
      const cctvLookup = new Map();

      if (cctvNodes.length) {
        cctvNodes.forEach((node) => {
          const projected = projectPoint(node.lat, node.lon, camera, viewport, globeRadius);
          if (!projected.visible) {
            return;
          }

          const size = node.id === selectedCctvId ? 6.2 : 4.6;
          cctvLookup.set(node.id, {
            x: projected.x,
            y: projected.y,
            size,
            visible: true
          });

          const cellKey = `${quantize(projected.x, HIT_CELL_SIZE)}|${quantize(projected.y, HIT_CELL_SIZE)}`;
          if (!hitGrid.has(cellKey)) {
            hitGrid.set(cellKey, []);
          }

          hitGrid.get(cellKey).push({
            kind: 'cctv',
            id: node.id,
            x: projected.x,
            y: projected.y,
            hitRadius: Math.max(11, size * 2.2)
          });
        });
      }

      const markerCount = renderFlights.length;
      const requiredSize = markerCount * MARKER_STRIDE;

      if (markerBufferRef.current.length < requiredSize) {
        markerBufferRef.current = new Float32Array(requiredSize * 1.3);
      }

      const markerBuffer = markerBufferRef.current;
      const markerLookup = markerLookupRef.current;
      markerLookup.clear();

      let markerWriteIndex = 0;

      renderFlights.forEach((flight) => {
        const projected = projectPoint(flight.lat, flight.lon, camera, viewport, globeRadius);
        projectedById.set(flight.id, projected);

        if (!projected.visible) {
          return;
        }

        const isMatch = !hasActiveFilters || matchSet.has(flight.id);
        const pulse = qualityTier === 'high'
          ? 1 + Math.sin(now * 0.007 + hashStringToUnit(flight.id) * Math.PI * 2) * 0.16
          : 1;
        const size = clamp((4.2 + projected.depth * 4.3) * camera.zoom, 3, mini ? 9 : 13) * (isMatch ? pulse : 0.85);
        const alpha = hasActiveFilters ? (isMatch ? 0.96 : 0.17) : 0.92;

        const rgb = getFlightColor(flight, highlightMilitary);
        const angle = buildProjectedHeadingAngle(flight, camera);

        markerBuffer[markerWriteIndex] = projected.x;
        markerBuffer[markerWriteIndex + 1] = projected.y;
        markerBuffer[markerWriteIndex + 2] = size;
        markerBuffer[markerWriteIndex + 3] = angle;
        markerBuffer[markerWriteIndex + 4] = rgb[0];
        markerBuffer[markerWriteIndex + 5] = rgb[1];
        markerBuffer[markerWriteIndex + 6] = rgb[2];
        markerBuffer[markerWriteIndex + 7] = alpha;
        markerBuffer[markerWriteIndex + 8] = isMatch ? 1 : 0;

        markerLookup.set(flight.id, {
          x: projected.x,
          y: projected.y,
          depth: projected.depth,
          size,
          visible: true
        });

        const cellKey = `${quantize(projected.x, HIT_CELL_SIZE)}|${quantize(projected.y, HIT_CELL_SIZE)}`;
        const hitRadius = Math.max(8, size * 1.45);

        if (!hitGrid.has(cellKey)) {
          hitGrid.set(cellKey, []);
        }

        hitGrid.get(cellKey).push({
          kind: 'flight',
          id: flight.id,
          x: projected.x,
          y: projected.y,
          hitRadius
        });

        markerWriteIndex += MARKER_STRIDE;
      });

      hitGridRef.current = hitGrid;

      if (linkEdges.length) {
        drawLinkEdges(context, linkEdges, projectedById);
      }

      const markerGlow = qualityTier === 'high' || ((qualityTier === 'medium' || qualityTier === 'mini') && markerWriteIndex < 850 * MARKER_STRIDE);

      for (let index = 0; index < markerWriteIndex; index += MARKER_STRIDE) {
        const x = markerBuffer[index];
        const y = markerBuffer[index + 1];
        const size = markerBuffer[index + 2];
        const angle = markerBuffer[index + 3];
        const color = formatColorTriplet(
          markerBuffer[index + 4] * 255,
          markerBuffer[index + 5] * 255,
          markerBuffer[index + 6] * 255
        );
        const alpha = markerBuffer[index + 7];

        drawArrow(context, x, y, size, angle, color, alpha, markerGlow);
      }

      if (!mini && showAircraft && selectedFlightId && markerLookup.has(selectedFlightId)) {
        const marker = markerLookup.get(selectedFlightId);

        context.save();
        context.translate(marker.x, marker.y);

        context.strokeStyle = 'rgba(247, 187, 84, 0.88)';
        context.lineWidth = 1.25;
        context.setLineDash([5, 5]);
        context.lineDashOffset = -(now * 0.045) % 100;
        context.beginPath();
        context.arc(0, 0, marker.size + 9 + Math.sin(now * 0.006) * 1.6, 0, Math.PI * 2);
        context.stroke();

        context.setLineDash([]);
        context.strokeStyle = 'rgba(255, 219, 155, 0.6)';
        context.beginPath();
        context.arc(0, 0, marker.size + 16, 0, Math.PI * 2);
        context.stroke();

        context.beginPath();
        context.moveTo(-marker.size - 18, 0);
        context.lineTo(-marker.size - 8, 0);
        context.moveTo(marker.size + 8, 0);
        context.lineTo(marker.size + 18, 0);
        context.moveTo(0, -marker.size - 18);
        context.lineTo(0, -marker.size - 8);
        context.moveTo(0, marker.size + 8);
        context.lineTo(0, marker.size + 18);
        context.stroke();

        context.restore();
      }

      if (!mini && selectedCctvId && cctvLookup.has(selectedCctvId)) {
        const nodeMarker = cctvLookup.get(selectedCctvId);

        context.save();
        context.translate(nodeMarker.x, nodeMarker.y);
        context.strokeStyle = 'rgba(110, 229, 255, 0.9)';
        context.lineWidth = 1.1;
        context.setLineDash([3, 4]);
        context.lineDashOffset = -(now * 0.05) % 80;
        context.beginPath();
        context.arc(0, 0, nodeMarker.size + 6.5, 0, Math.PI * 2);
        context.stroke();

        context.setLineDash([]);
        context.strokeStyle = 'rgba(196, 244, 255, 0.58)';
        context.beginPath();
        context.arc(0, 0, nodeMarker.size + 11.5, 0, Math.PI * 2);
        context.stroke();

        context.beginPath();
        context.moveTo(-nodeMarker.size - 13, 0);
        context.lineTo(-nodeMarker.size - 5, 0);
        context.moveTo(nodeMarker.size + 5, 0);
        context.lineTo(nodeMarker.size + 13, 0);
        context.moveTo(0, -nodeMarker.size - 13);
        context.lineTo(0, -nodeMarker.size - 5);
        context.moveTo(0, nodeMarker.size + 5);
        context.lineTo(0, nodeMarker.size + 13);
        context.stroke();
        context.restore();
      }

      context.restore();
      applyVisualSkin(context, width, height, visualSkin, now, qualityTier);

      fpsRef.current.frameCount += 1;
      const elapsed = now - fpsRef.current.startMs;
      if (elapsed > 1000) {
        const fps = (fpsRef.current.frameCount * 1000) / elapsed;
        if (typeof onRenderFpsRef.current === 'function') {
          onRenderFpsRef.current(fps);
        }
        fpsRef.current.frameCount = 0;
        fpsRef.current.startMs = now;
      }

      animationFrameRef.current = requestAnimationFrame(renderFrame);
    };

    animationFrameRef.current = requestAnimationFrame(renderFrame);

    return () => {
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, [
    renderFlights,
    qualityTier,
    densityMode,
    densitySnapshot,
    satellites,
    seismicEvents,
    cctvNodes,
    streetTraffic,
    politicalMap,
    visualSkin,
    highlightMilitary,
    performanceMode,
    showAircraft,
    selectedPredictionPath,
    selectedFlight,
    selectedFlightId,
    selectedCctvId,
    cameraMode,
    cameraRegion,
    trackTarget,
    matchSet,
    hasActiveFilters,
    sensorMode,
    sensorVolumes,
    linkEdges,
    mini,
    showCountryNames,
    focusTarget,
    staticView,
    disableSelection
  ]);

  return (
    <canvas
      ref={canvasRef}
      className={`godseye-canvas${mini ? ' mini' : ''}`}
      aria-label="God's Eye global surveillance globe"
    />
  );
}

GlobeCanvas.displayName = 'GlobeCanvas';

export default React.memo(GlobeCanvas);
