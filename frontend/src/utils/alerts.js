import { bearingBetween, clamp } from './geo';

const KEEP_FIRING_MS = 20000;

function severityRank(severity) {
  if (severity === 'critical') {
    return 3;
  }
  if (severity === 'warning') {
    return 2;
  }
  return 1;
}

function buildKey(rule, suffix) {
  return `${rule}:${suffix}`;
}

function normalizeAlert(previous, nextPayload, nowMs) {
  const base = previous || {
    firstSeenAt: nowMs,
    occurrences: 0
  };

  return {
    ...base,
    ...nextPayload,
    firstSeenAt: base.firstSeenAt,
    lastSeenAt: nowMs,
    occurrences: (base.occurrences || 0) + 1,
    firing: true
  };
}

function computeHeadingMismatch(selectedFlight) {
  if (!selectedFlight || !Number.isFinite(selectedFlight.destinationLat) || !Number.isFinite(selectedFlight.destinationLon)) {
    return 0;
  }

  const routeBearing = bearingBetween(
    selectedFlight.lat,
    selectedFlight.lon,
    selectedFlight.destinationLat,
    selectedFlight.destinationLon
  );

  const delta = Math.abs(((selectedFlight.heading || 0) - routeBearing + 540) % 360 - 180);
  return delta;
}

export function evaluateAlertRules({
  nowMs,
  lastFetchMs,
  flights,
  selectedFlight,
  snapshotStatus,
  recordings,
  previousAlertsMap
}) {
  const activeMap = new Map();
  const previous = previousAlertsMap || new Map();

  const feedAgeMs = nowMs - (lastFetchMs || 0);
  const staleLimitMs = 35000;

  if (feedAgeMs > staleLimitMs) {
    const key = buildKey('feed_stale', 'global');
    activeMap.set(key, {
      key,
      rule: 'feed_stale',
      severity: 'critical',
      message: `Telemetry stale for ${Math.round(feedAgeMs / 1000)}s`,
      labels: { scope: 'global' }
    });
  }

  if (snapshotStatus === 'degraded' || snapshotStatus === 'mock') {
    const key = buildKey('provider_degraded', snapshotStatus);
    activeMap.set(key, {
      key,
      rule: 'provider_degraded',
      severity: snapshotStatus === 'mock' ? 'warning' : 'critical',
      message: snapshotStatus === 'mock'
        ? 'Primary providers unavailable, using simulation feed'
        : 'Provider degraded',
      labels: { status: snapshotStatus }
    });
  }

  const rollingAvg = recordings?.derived?.rollingCountAvg || flights.length;
  if (rollingAvg > 80 && flights.length < rollingAvg * 0.45) {
    const dropPct = clamp((1 - flights.length / rollingAvg) * 100, 0, 100);
    const key = buildKey('traffic_drop', 'global');
    activeMap.set(key, {
      key,
      rule: 'traffic_drop',
      severity: 'warning',
      message: `Global visible traffic dropped ${Math.round(dropPct)}% below rolling baseline`,
      labels: { baseline: Math.round(rollingAvg), current: flights.length }
    });
  }

  const unstableFlights = flights
    .filter((flight) => Math.abs(flight.verticalRate || 0) > 12)
    .sort((a, b) => Math.abs(b.verticalRate) - Math.abs(a.verticalRate))
    .slice(0, 3);

  unstableFlights.forEach((flight) => {
    const key = buildKey('high_vertical_rate', flight.id);
    activeMap.set(key, {
      key,
      rule: 'high_vertical_rate',
      severity: 'warning',
      message: `${flight.callsign || flight.id} vertical rate ${flight.verticalRate.toFixed(1)} m/s`,
      labels: { flightId: flight.id }
    });
  });

  if (selectedFlight) {
    const mismatch = computeHeadingMismatch(selectedFlight);
    if (mismatch > 55) {
      const key = buildKey('target_off_route', selectedFlight.id);
      activeMap.set(key, {
        key,
        rule: 'target_off_route',
        severity: 'critical',
        message: `Target ${selectedFlight.callsign} heading mismatch ${Math.round(mismatch)}°`,
        labels: { flightId: selectedFlight.id }
      });
    }
  }

  const nextMap = new Map();
  const allKeys = new Set([...previous.keys(), ...activeMap.keys()]);

  allKeys.forEach((key) => {
    const previousAlert = previous.get(key);
    const nextPayload = activeMap.get(key);

    if (nextPayload) {
      nextMap.set(key, normalizeAlert(previousAlert, nextPayload, nowMs));
      return;
    }

    if (!previousAlert) {
      return;
    }

    const ageSinceLastSeen = nowMs - (previousAlert.lastSeenAt || nowMs);
    if (ageSinceLastSeen <= KEEP_FIRING_MS) {
      nextMap.set(key, {
        ...previousAlert,
        firing: true,
        cooldown: true
      });
    }
  });

  const activeAlerts = Array.from(nextMap.values()).sort((a, b) => {
    const severityDiff = severityRank(b.severity) - severityRank(a.severity);
    if (severityDiff !== 0) {
      return severityDiff;
    }

    return (b.lastSeenAt || 0) - (a.lastSeenAt || 0);
  });

  return {
    alertsMap: nextMap,
    activeAlerts
  };
}
