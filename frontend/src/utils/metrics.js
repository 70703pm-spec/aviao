function average(entries) {
  if (!entries.length) {
    return 0;
  }
  return entries.reduce((acc, value) => acc + value, 0) / entries.length;
}

function keepWindow(entries, max = 120) {
  if (entries.length <= max) {
    return entries;
  }
  return entries.slice(entries.length - max);
}

export function createFrontendMetrics() {
  const state = {
    apiLatenciesMs: [],
    renderFps: [],
    selectionHitMs: [],
    densityComputeMs: []
  };

  return {
    noteApiLatency(ms) {
      state.apiLatenciesMs = keepWindow([...state.apiLatenciesMs, ms], 90);
    },
    noteRenderFps(fps) {
      state.renderFps = keepWindow([...state.renderFps, fps], 90);
    },
    noteSelectionHit(ms) {
      state.selectionHitMs = keepWindow([...state.selectionHitMs, ms], 90);
    },
    noteDensityCompute(ms) {
      state.densityComputeMs = keepWindow([...state.densityComputeMs, ms], 90);
    },
    snapshot(extra = {}) {
      return {
        apiLatencyMs: Math.round(average(state.apiLatenciesMs)),
        renderFps: Math.round(average(state.renderFps)),
        selectionHitMs: Math.round(average(state.selectionHitMs)),
        densityComputeMs: Math.round(average(state.densityComputeMs)),
        ...extra
      };
    }
  };
}
