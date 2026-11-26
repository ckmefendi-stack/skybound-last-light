// Procedural sound for SKYBOUND: LAST LIGHT — no audio files, everything is synthesized
// with Web Audio after the player's first gesture (browsers block audio before that).
// Engine hum follows throttle, wind follows speed, and rings, touchdown and stall get cues.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let windGain = null;
  let windFilter = null;
  let started = false;

  function start() {
    if (started) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.14;
      master.connect(ctx.destination);
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      const wind = ctx.createBufferSource();
      wind.buffer = buffer;
      wind.loop = true;
      windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 500;
      windFilter.Q.value = 0.6;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      wind.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(master);
      wind.start();
      started = true;
    } catch {
      // Audio is decoration: a game that cannot make sound still plays.
      started = false;
    }
  }

  function blip(freq, dur, type, vol, when) {
    if (!started) return;
    const t0 = ctx.currentTime + (when || 0);
    const osc = ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.5, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  return {
    start,
    /** Continuous engine and wind levels from the flight state. */
    update(telemetry) {
      if (!started) return;
      const running = telemetry.throttlePct > 2 || telemetry.speedKt > 20;
      engineOsc.frequency.value = 55 + telemetry.throttlePct * 0.9;
      engineGain.gain.value = running ? 0.05 + (telemetry.throttlePct / 100) * 0.1 : 0;
      windGain.gain.value = Math.min(0.16, telemetry.speedKt * 0.0009);
      windFilter.frequency.value = 300 + telemetry.speedKt * 4;
    },
    ring() {
      blip(880, 0.18, 'sine', 0.5, 0);
      blip(1318, 0.28, 'sine', 0.4, 0.09);
    },
    touchdown() {
      blip(90, 0.3, 'sine', 0.8, 0);
      blip(55, 0.4, 'sine', 0.6, 0.05);
    },
    crash() {
      blip(70, 0.7, 'sawtooth', 0.6, 0);
      blip(45, 0.9, 'sawtooth', 0.5, 0.1);
    },
    stall() {
      blip(220, 0.4, 'square', 0.16, 0);
    },
  };
}
