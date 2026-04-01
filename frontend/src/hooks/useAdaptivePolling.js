import { useEffect, useRef, useState } from 'react';
import {
  POLL_FAST_STARTUP_MS,
  POLL_FAST_STEADY_MS,
  POLL_SLOW_STARTUP_MS,
  POLL_SLOW_STEADY_MS
} from '../config/constants';

/**
 * Shadowbroker-inspired adaptive polling hook.
 *
 * Fast tier: latency-sensitive updates (flight telemetry).
 * Slow tier: heavier updates (density/intel overlays).
 */
export function useAdaptivePolling({
  fastFetcher,
  slowFetcher,
  onFastData,
  onSlowData,
  onFastError,
  onSlowError,
  enabled = true,
  hasSteadySignal = (payload) => {
    const count = Array.isArray(payload?.flights) ? payload.flights.length : 0;
    return count >= 100;
  },
  fastStartupMs = POLL_FAST_STARTUP_MS,
  fastSteadyMs = POLL_FAST_STEADY_MS,
  slowStartupMs = POLL_SLOW_STARTUP_MS,
  slowSteadyMs = POLL_SLOW_STEADY_MS
}) {
  const [backendStatus, setBackendStatus] = useState('connecting');

  const hasDataRef = useRef(false);
  const fastTimerRef = useRef(null);
  const slowTimerRef = useRef(null);
  const fastAbortRef = useRef(null);
  const slowAbortRef = useRef(null);

  const fastFetcherRef = useRef(fastFetcher);
  const slowFetcherRef = useRef(slowFetcher);
  const onFastDataRef = useRef(onFastData);
  const onSlowDataRef = useRef(onSlowData);
  const onFastErrorRef = useRef(onFastError);
  const onSlowErrorRef = useRef(onSlowError);
  const steadySignalRef = useRef(hasSteadySignal);

  useEffect(() => {
    fastFetcherRef.current = fastFetcher;
  }, [fastFetcher]);

  useEffect(() => {
    slowFetcherRef.current = slowFetcher;
  }, [slowFetcher]);

  useEffect(() => {
    onFastDataRef.current = onFastData;
  }, [onFastData]);

  useEffect(() => {
    onSlowDataRef.current = onSlowData;
  }, [onSlowData]);

  useEffect(() => {
    onFastErrorRef.current = onFastError;
  }, [onFastError]);

  useEffect(() => {
    onSlowErrorRef.current = onSlowError;
  }, [onSlowError]);

  useEffect(() => {
    steadySignalRef.current = hasSteadySignal;
  }, [hasSteadySignal]);

  useEffect(() => {
    if (!enabled || typeof fastFetcherRef.current !== 'function') {
      return () => {};
    }

    let active = true;

    const scheduleFast = () => {
      const delay = hasDataRef.current ? fastSteadyMs : fastStartupMs;
      fastTimerRef.current = setTimeout(runFastPoll, delay);
    };

    const scheduleSlow = () => {
      if (typeof slowFetcherRef.current !== 'function') {
        return;
      }
      const delay = hasDataRef.current ? slowSteadyMs : slowStartupMs;
      slowTimerRef.current = setTimeout(runSlowPoll, delay);
    };

    const runFastPoll = async () => {
      if (!active || typeof fastFetcherRef.current !== 'function') {
        return;
      }

      const controller = new AbortController();
      fastAbortRef.current = controller;

      try {
        const payload = await fastFetcherRef.current({ signal: controller.signal });
        if (!active) {
          return;
        }

        if (steadySignalRef.current(payload)) {
          hasDataRef.current = true;
        }

        setBackendStatus('connected');

        if (typeof onFastDataRef.current === 'function') {
          onFastDataRef.current(payload);
        }
      } catch (error) {
        if (controller.signal.aborted || !active) {
          return;
        }

        setBackendStatus('disconnected');

        if (typeof onFastErrorRef.current === 'function') {
          onFastErrorRef.current(error);
        }
      } finally {
        if (active) {
          scheduleFast();
        }
      }
    };

    const runSlowPoll = async () => {
      if (!active || typeof slowFetcherRef.current !== 'function') {
        return;
      }

      const controller = new AbortController();
      slowAbortRef.current = controller;

      try {
        const payload = await slowFetcherRef.current({ signal: controller.signal });
        if (!active) {
          return;
        }

        if (typeof onSlowDataRef.current === 'function') {
          onSlowDataRef.current(payload);
        }
      } catch (error) {
        if (controller.signal.aborted || !active) {
          return;
        }

        if (typeof onSlowErrorRef.current === 'function') {
          onSlowErrorRef.current(error);
        }
      } finally {
        if (active) {
          scheduleSlow();
        }
      }
    };

    runFastPoll();
    runSlowPoll();

    return () => {
      active = false;
      if (fastTimerRef.current) {
        clearTimeout(fastTimerRef.current);
      }
      if (slowTimerRef.current) {
        clearTimeout(slowTimerRef.current);
      }
      if (fastAbortRef.current) {
        fastAbortRef.current.abort();
      }
      if (slowAbortRef.current) {
        slowAbortRef.current.abort();
      }
    };
  }, [
    enabled,
    fastStartupMs,
    fastSteadyMs,
    slowStartupMs,
    slowSteadyMs
  ]);

  return {
    backendStatus,
    hasSteadyData: hasDataRef.current
  };
}

export default useAdaptivePolling;
