// Procedural audio for Solmar Heat: every sound is synthesised live with
// WebAudio — no audio files, nothing to download. A lazy AudioContext is
// only created on the first user gesture (browsers refuse sound before
// one), then three continuous voices follow the game: a two-stroke engine
// whose pitch tracks road speed, a two-tone patrol siren that swells as
// the nearest unit closes in, and a soft bay-wash ambience under
// everything. Short one-shots — pickup blips, the mission-complete
// arpeggio, the finale fanfare, shove and bumper thuds, the busted sting —
// are fired by name from the event stream the world simulation produces.
// M toggles mute. If WebAudio is missing entirely, every call is a no-op.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let engineFilter = null;
  let sirenOsc = null;
  let sirenGain = null;
  let muted = false;
  let updateClock = 0;

  function unlock() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return;
    }
    try {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return;
      ctx = new AudioCtor();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.9;
      master.connect(ctx.destination);

      // Engine: a sawtooth through a lowpass, idling low and silent until
      // the player is actually driving.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();

      // Siren: a square wave whose pitch an LFO swings between two tones.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'square';
      sirenOsc.frequency.value = 815;
      const sirenLfo = ctx.createOscillator();
      sirenLfo.type = 'triangle';
      sirenLfo.frequency.value = 0.55;
      const sirenSwing = ctx.createGain();
      sirenSwing.gain.value = 135;
      sirenLfo.connect(sirenSwing);
      sirenSwing.connect(sirenOsc.frequency);
      const sirenFilter = ctx.createBiquadFilter();
      sirenFilter.type = 'bandpass';
      sirenFilter.frequency.value = 900;
      sirenFilter.Q.value = 2.5;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenFilter);
      sirenFilter.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      sirenLfo.start();

      // Bay wash: looped filtered noise, swelling slowly like the tide.
      const noiseLength = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, noiseLength, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < noiseLength; i += 1) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      noise.loop = true;
      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'lowpass';
      noiseFilter.frequency.value = 420;
      const noiseGain = ctx.createGain();
      noiseGain.gain.value = 0.014;
      const tide = ctx.createOscillator();
      tide.frequency.value = 0.09;
      const tideSwing = ctx.createGain();
      tideSwing.gain.value = 0.007;
      tide.connect(tideSwing);
      tideSwing.connect(noiseGain.gain);
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(master);
      noise.start();
      tide.start();
    } catch {
      ctx = null;
    }
  }

  function tone(freq, seconds, { type = 'sine', gain = 0.12, delay = 0, slideTo = null } = {}) {
    if (!ctx || !master) return;
    try {
      const start = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + seconds);
      const amp = ctx.createGain();
      amp.gain.setValueAtTime(0, start);
      amp.gain.linearRampToValueAtTime(gain, start + 0.012);
      amp.gain.exponentialRampToValueAtTime(0.001, start + seconds);
      osc.connect(amp);
      amp.connect(master);
      osc.start(start);
      osc.stop(start + seconds + 0.05);
    } catch {
      // A failed one-shot is silence, never an exception in the game loop.
    }
  }

  function thud(strength = 1) {
    if (!ctx || !master) return;
    try {
      const length = Math.floor(ctx.sampleRate * 0.12);
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 300;
      const amp = ctx.createGain();
      amp.gain.value = Math.min(0.5, 0.22 * strength);
      source.connect(filter);
      filter.connect(amp);
      amp.connect(master);
      source.start();
    } catch {
      // Silence on failure, as above.
    }
  }

  function play(name) {
    if (!ctx) return;
    if (name === 'pickup') {
      tone(660, 0.09, { type: 'sine', gain: 0.14 });
      tone(880, 0.12, { type: 'sine', gain: 0.14, delay: 0.07 });
    } else if (name === 'mission-complete') {
      tone(523, 0.14, { type: 'triangle', gain: 0.16 });
      tone(659, 0.14, { type: 'triangle', gain: 0.16, delay: 0.1 });
      tone(784, 0.22, { type: 'triangle', gain: 0.16, delay: 0.2 });
    } else if (name === 'finale') {
      tone(523, 0.16, { type: 'triangle', gain: 0.17 });
      tone(659, 0.16, { type: 'triangle', gain: 0.17, delay: 0.11 });
      tone(784, 0.16, { type: 'triangle', gain: 0.17, delay: 0.22 });
      tone(1046, 0.4, { type: 'triangle', gain: 0.18, delay: 0.33 });
      tone(1318, 0.45, { type: 'sine', gain: 0.1, delay: 0.44 });
    } else if (name === 'thud') {
      thud(1);
    } else if (name === 'bump') {
      thud(1.8);
    } else if (name === 'busted') {
      tone(392, 0.22, { type: 'sawtooth', gain: 0.1, slideTo: 330 });
      tone(330, 0.22, { type: 'sawtooth', gain: 0.1, delay: 0.2, slideTo: 262 });
      tone(262, 0.42, { type: 'sawtooth', gain: 0.1, delay: 0.4, slideTo: 196 });
    } else if (name === 'click') {
      tone(1150, 0.05, { type: 'square', gain: 0.05 });
    }
  }

  function update(dt, info) {
    if (!ctx || !engineGain || !sirenGain) return;
    updateClock -= dt;
    if (updateClock > 0) return;
    updateClock = 0.08;
    try {
      const now = ctx.currentTime;
      const driving = info.mode === 'drive';
      const speedRatio = Math.min(1, Math.abs(info.speedKmh ?? 0) / 130);
      const engineTarget = driving ? 0.05 + speedRatio * 0.05 : 0;
      engineGain.gain.setTargetAtTime(engineTarget, now, 0.09);
      engineOsc.frequency.setTargetAtTime(55 + speedRatio * 165, now, 0.09);
      engineFilter.frequency.setTargetAtTime(320 + speedRatio * 900, now, 0.09);
      // The siren belongs to the nearest patrol unit: silent with no
      // stars, a whisper at 60 m, full voice on your bumper.
      let sirenTarget = 0;
      if ((info.wanted ?? 0) > 0 && Number.isFinite(info.policeDistance)) {
        const closeness = Math.max(0, Math.min(1, 1 - info.policeDistance / 65));
        sirenTarget = 0.012 + closeness * 0.05;
      }
      sirenGain.gain.setTargetAtTime(sirenTarget, now, 0.12);
    } catch {
      // Continuous voices failing must never break the frame loop.
    }
  }

  window.addEventListener('keydown', (event) => {
    if (event.code !== 'KeyM') return;
    muted = !muted;
    if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.03);
  });

  return {
    unlock,
    play,
    update,
    get muted() {
      return muted;
    },
    get running() {
      return ctx !== null && ctx.state === 'running';
    },
    get contextState() {
      return ctx ? ctx.state : 'none';
    },
  };
}
