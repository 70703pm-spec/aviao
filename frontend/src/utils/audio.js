function createNoopEngine() {
  return {
    setEnabled: () => {},
    blip: () => {},
    lock: () => {},
    destroy: () => {}
  };
}

export function initAudioEngine() {
  const Context = window.AudioContext || window.webkitAudioContext;

  if (!Context) {
    return createNoopEngine();
  }

  const context = new Context();
  const masterGain = context.createGain();
  masterGain.gain.value = 0;
  masterGain.connect(context.destination);

  const ambientOsc = context.createOscillator();
  const ambientLfo = context.createOscillator();
  const ambientLfoGain = context.createGain();

  ambientOsc.type = 'sawtooth';
  ambientOsc.frequency.value = 38;

  ambientLfo.type = 'sine';
  ambientLfo.frequency.value = 0.22;
  ambientLfoGain.gain.value = 2.4;

  ambientLfo.connect(ambientLfoGain);
  ambientLfoGain.connect(ambientOsc.frequency);

  const ambientGain = context.createGain();
  ambientGain.gain.value = 0.0001;

  ambientOsc.connect(ambientGain);
  ambientGain.connect(masterGain);

  ambientOsc.start();
  ambientLfo.start();

  function playTone({ frequency, durationMs, type = 'sine', gain = 0.05, sweep = 0 }) {
    const tone = context.createOscillator();
    const toneGain = context.createGain();
    tone.type = type;

    const now = context.currentTime;

    tone.frequency.setValueAtTime(frequency, now);
    if (sweep !== 0) {
      tone.frequency.linearRampToValueAtTime(frequency + sweep, now + durationMs / 1000);
    }

    toneGain.gain.setValueAtTime(0.0001, now);
    toneGain.gain.exponentialRampToValueAtTime(gain, now + 0.015);
    toneGain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);

    tone.connect(toneGain);
    toneGain.connect(masterGain);
    tone.start(now);
    tone.stop(now + durationMs / 1000 + 0.05);
  }

  let enabled = false;

  return {
    setEnabled(nextEnabled) {
      enabled = nextEnabled;
      if (context.state === 'suspended') {
        context.resume();
      }

      const now = context.currentTime;
      const targetGain = enabled ? 0.06 : 0.0001;
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.exponentialRampToValueAtTime(targetGain, now + 0.45);
      ambientGain.gain.cancelScheduledValues(now);
      ambientGain.gain.exponentialRampToValueAtTime(enabled ? 0.012 : 0.0001, now + 0.35);
    },
    blip() {
      if (!enabled) {
        return;
      }

      playTone({ frequency: 620, durationMs: 110, type: 'triangle', gain: 0.03, sweep: 90 });
    },
    lock() {
      if (!enabled) {
        return;
      }

      playTone({ frequency: 330, durationMs: 140, type: 'square', gain: 0.022, sweep: 160 });
      setTimeout(() => {
        playTone({ frequency: 510, durationMs: 120, type: 'square', gain: 0.018, sweep: -90 });
      }, 85);
    },
    destroy() {
      try {
        ambientOsc.stop();
        ambientLfo.stop();
        context.close();
      } catch (error) {
        // Ignore shutdown race conditions.
      }
    }
  };
}
