const WINDOW_MAX = 120;

function clampWindow(windowEntries, max) {
  if (windowEntries.length <= max) {
    return windowEntries;
  }
  return windowEntries.slice(windowEntries.length - max);
}

export function createRecordingState() {
  return {
    samples: [],
    derived: {
      rollingCountAvg: 0,
      descendingRatio: 0,
      avgSpeed: 0,
      trafficByRegion: {},
      typeCounts: {},
      total: 0
    }
  };
}

export function updateRecordingState(previousState, flights, nowMs = Date.now()) {
  const state = previousState || createRecordingState();

  const total = flights.length;
  const descendingCount = flights.reduce((acc, flight) => (
    flight.verticalRate < -1.5 ? acc + 1 : acc
  ), 0);

  const speedTotal = flights.reduce((acc, flight) => acc + (flight.speed || 0), 0);

  const trafficByRegion = flights.reduce((acc, flight) => {
    const region = flight.region || 'global';
    acc[region] = (acc[region] || 0) + 1;
    return acc;
  }, {});

  const typeCounts = flights.reduce((acc, flight) => {
    const type = flight.aircraftType || 'Unknown';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  const sample = {
    timestamp: nowMs,
    total,
    descendingRatio: total > 0 ? descendingCount / total : 0,
    avgSpeed: total > 0 ? speedTotal / total : 0
  };

  const samples = clampWindow([...state.samples, sample], WINDOW_MAX);

  const rollingCountAvg = samples.length > 0
    ? samples.reduce((acc, entry) => acc + entry.total, 0) / samples.length
    : total;

  const derived = {
    rollingCountAvg,
    descendingRatio: sample.descendingRatio,
    avgSpeed: sample.avgSpeed,
    trafficByRegion,
    typeCounts,
    total
  };

  return {
    samples,
    derived
  };
}

export function summarizeRecordingState(recordingState) {
  const state = recordingState || createRecordingState();
  const { derived } = state;

  return {
    rollingCountAvg: Math.round(derived.rollingCountAvg || 0),
    descendingRatioPercent: Math.round((derived.descendingRatio || 0) * 100),
    avgSpeedKnots: Math.round((derived.avgSpeed || 0) * 1.94384),
    trafficByRegion: derived.trafficByRegion || {},
    typeCounts: derived.typeCounts || {},
    total: derived.total || 0
  };
}
