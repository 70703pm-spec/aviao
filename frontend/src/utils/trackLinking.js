import { haversineDistanceKm } from './geo';

function pushLink(linkMap, sourceId, targetLink) {
  if (!linkMap.has(sourceId)) {
    linkMap.set(sourceId, []);
  }

  const links = linkMap.get(sourceId);
  const exists = links.some((link) => link.targetId === targetLink.targetId && link.reason === targetLink.reason);

  if (!exists) {
    links.push(targetLink);
  }
}

export function computeTrackLinks(flights) {
  const linksById = new Map();
  const edges = [];

  const byCallsign = new Map();
  const byRoute = new Map();

  flights.forEach((flight) => {
    const callsign = (flight.callsign || '').trim().toUpperCase();
    const routeKey = `${flight.airline || 'UNK'}:${flight.origin || 'UNK'}:${flight.destination || 'UNK'}`;

    if (callsign) {
      if (!byCallsign.has(callsign)) {
        byCallsign.set(callsign, []);
      }
      byCallsign.get(callsign).push(flight);
    }

    if (!byRoute.has(routeKey)) {
      byRoute.set(routeKey, []);
    }
    byRoute.get(routeKey).push(flight);
  });

  byCallsign.forEach((group) => {
    if (group.length < 2) {
      return;
    }

    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const a = group[i];
        const b = group[j];

        const distance = haversineDistanceKm(a.lat, a.lon, b.lat, b.lon);
        const score = distance < 250 ? 0.92 : 0.7;

        const edge = {
          from: a.id,
          to: b.id,
          reason: 'callsign',
          score,
          distanceKm: distance
        };

        edges.push(edge);
        pushLink(linksById, a.id, { targetId: b.id, reason: 'callsign', score, distanceKm: distance });
        pushLink(linksById, b.id, { targetId: a.id, reason: 'callsign', score, distanceKm: distance });
      }
    }
  });

  byRoute.forEach((group) => {
    if (group.length < 2) {
      return;
    }

    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const a = group[i];
        const b = group[j];

        const distance = haversineDistanceKm(a.lat, a.lon, b.lat, b.lon);
        if (distance > 400) {
          continue;
        }

        const score = 0.56;

        const edge = {
          from: a.id,
          to: b.id,
          reason: 'route-proximity',
          score,
          distanceKm: distance
        };

        edges.push(edge);
        pushLink(linksById, a.id, { targetId: b.id, reason: 'route-proximity', score, distanceKm: distance });
        pushLink(linksById, b.id, { targetId: a.id, reason: 'route-proximity', score, distanceKm: distance });
      }
    }
  });

  linksById.forEach((links, flightId) => {
    links.sort((a, b) => b.score - a.score);
    linksById.set(flightId, links.slice(0, 6));
  });

  return {
    linksById,
    edges
  };
}

export function linkedTracksForFlight(linkIndex, flightId, flightsById) {
  if (!flightId || !linkIndex?.linksById?.has(flightId)) {
    return [];
  }

  return linkIndex.linksById.get(flightId).map((link) => ({
    ...link,
    flight: flightsById.get(link.targetId) || null
  }));
}

export function computeFocusedTrackLinks(selectedFlight, flights, limit = 8) {
  if (!selectedFlight || !Array.isArray(flights) || flights.length < 2) {
    return { links: [], edges: [] };
  }

  const normalizedCallsign = (selectedFlight.callsign || '').trim().toUpperCase();
  const normalizedAirline = (selectedFlight.airline || '').trim().toUpperCase();
  const normalizedOrigin = (selectedFlight.origin || '').trim().toUpperCase();
  const normalizedDestination = (selectedFlight.destination || '').trim().toUpperCase();

  const candidates = [];
  const nearest = [];

  flights.forEach((flight) => {
    if (!flight || flight.id === selectedFlight.id) {
      return;
    }

    const distanceKm = haversineDistanceKm(
      selectedFlight.lat,
      selectedFlight.lon,
      flight.lat,
      flight.lon
    );

    if (!Number.isFinite(distanceKm)) {
      return;
    }

    const callsign = (flight.callsign || '').trim().toUpperCase();
    const airline = (flight.airline || '').trim().toUpperCase();
    const origin = (flight.origin || '').trim().toUpperCase();
    const destination = (flight.destination || '').trim().toUpperCase();

    let reason = null;
    let score = 0;

    if (normalizedCallsign && callsign && normalizedCallsign === callsign) {
      reason = 'callsign';
      score = Math.max(0.72, 0.95 - Math.min(0.2, distanceKm / 2200));
    } else if (
      normalizedAirline &&
      airline &&
      normalizedAirline === airline &&
      normalizedOrigin &&
      normalizedDestination &&
      origin === normalizedOrigin &&
      destination === normalizedDestination
    ) {
      reason = 'route-match';
      score = Math.max(0.52, 0.82 - Math.min(0.25, distanceKm / 1800));
    } else if (distanceKm < 350) {
      reason = 'proximity';
      score = Math.max(0.36, 0.62 - Math.min(0.24, distanceKm / 900));
    }

    nearest.push({ flight, distanceKm });

    if (reason) {
      candidates.push({
        targetId: flight.id,
        reason,
        score,
        distanceKm,
        flight
      });
    }
  });

  candidates.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.distanceKm - b.distanceKm;
  });

  const taken = new Set();
  const links = [];

  for (let index = 0; index < candidates.length && links.length < limit; index += 1) {
    const item = candidates[index];
    if (taken.has(item.targetId)) {
      continue;
    }
    links.push(item);
    taken.add(item.targetId);
  }

  if (links.length < Math.min(4, limit)) {
    nearest.sort((a, b) => a.distanceKm - b.distanceKm);
    for (let index = 0; index < nearest.length && links.length < limit; index += 1) {
      const item = nearest[index];
      if (taken.has(item.flight.id)) {
        continue;
      }
      if (item.distanceKm > 1600) {
        break;
      }
      links.push({
        targetId: item.flight.id,
        reason: 'nearest',
        score: Math.max(0.28, 0.52 - Math.min(0.22, item.distanceKm / 1900)),
        distanceKm: item.distanceKm,
        flight: item.flight
      });
      taken.add(item.flight.id);
    }
  }

  const edges = links.map((link) => ({
    from: selectedFlight.id,
    to: link.targetId,
    reason: link.reason,
    score: link.score,
    distanceKm: link.distanceKm
  }));

  return {
    links,
    edges
  };
}
