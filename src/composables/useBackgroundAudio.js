// Procedural background music (no audio files, nothing copyrighted): everything is synthesized with the Web Audio API.
// Audio only starts from a user tap (createEngine().start() is called from a click handler) and stops cleanly (fade out, timers cleared, context closed).
const MIDI = (n) => 440 * Math.pow(2, (n - 69) / 12);
const CHORDS = {
  lofi: [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65]], // Cmaj7 Am7 Fmaj7 G7
  night: [[57, 60, 64, 67], [53, 57, 60, 64], [60, 64, 67, 71], [52, 55, 59, 62]], // Am7 Fmaj7 Cmaj7 Em7
  jazz: [[62, 65, 69, 72], [55, 59, 62, 65], [60, 64, 67, 71], [57, 61, 64, 67]], // Dm9-ish ii-V-I-VI
  chill: [[57, 60, 64, 67], [62, 65, 69, 72], [55, 59, 62, 65], [60, 64, 67, 71]],
  piano: [[60, 64, 67, 74], [55, 59, 62, 69], [57, 60, 64, 71], [53, 57, 60, 67]], // C G/B Am F (add9)
  midnight: [[50, 53, 57, 60], [46, 50, 53, 57], [43, 46, 50, 53], [45, 49, 52, 55]], // Dm7 Bbmaj7 Gm7 A7
  cafe: [[65, 69, 72, 76], [62, 65, 69, 72], [67, 70, 74, 77], [60, 64, 67, 70]], // Fmaj7 Dm7 Gm7 C7
  sunset: [[64, 67, 71, 74], [60, 64, 67, 71], [62, 66, 69, 72], [59, 62, 66, 69]], // Em7 Cmaj7 D7 Bm7
  ambient: [[48, 55, 62, 67], [45, 52, 60, 64], [41, 48, 57, 64], [43, 50, 59, 62]],
};

// Extra lo-fi styles, all procedural (original, no samples): chord set, tempo, drums, timbre and ambience bed.
export const STYLES = {
  'lofi-rain': { chords: 'night', bpm: 66, drums: true, comp: false, wave: 'triangle', cut: 1300, mel: 0.3, bed: 'rain' },
  'lofi-jazz': { chords: 'jazz', bpm: 82, drums: true, comp: true, wave: 'triangle', cut: 1900, mel: 0.45, bed: 'vinyl', bass: true },
  'chill-beats': { chords: 'chill', bpm: 88, drums: true, comp: true, wave: 'square', cut: 1100, mel: 0.25, bed: 'vinyl', bass: true },
  'lofi-piano': { chords: 'piano', bpm: 64, drums: false, comp: false, wave: 'sine', cut: 3000, mel: 0.55, bed: 'vinyl', arp: true },
  'midnight-drive': { chords: 'midnight', bpm: 70, drums: true, comp: false, wave: 'sawtooth', cut: 900, mel: 0.2, bed: 'none', bass: true },
  'cafe-corner': { chords: 'cafe', bpm: 78, drums: true, comp: true, wave: 'triangle', cut: 2200, mel: 0.4, bed: 'cafe' },
  'sunset-tape': { chords: 'sunset', bpm: 72, drums: true, comp: false, wave: 'triangle', cut: 1500, mel: 0.35, bed: 'vinyl', wobble: true },
};

const noiseBuffer = (ctx, seconds, kind = 'white') => {
  const n = Math.floor(ctx.sampleRate * seconds); const buf = ctx.createBuffer(1, n, ctx.sampleRate); const d = buf.getChannelData(0); let last = 0;
  for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; if (kind === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; }
  return buf;
};

export const createEngine = () => {
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  let ctx = null; let master = null; let analyser = null; let timer = 0; let nodes = []; let track = 'lofi'; let volume = 0.5; let playing = false;
  let nextTime = 0; let step = 0; let nextCrackle = 0;
  const data = new Uint8Array(256);

  const track$ = (n) => { nodes.push(n); return n; };
  const env = (g, t, a, peak, d) => { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };

  const note = (freq, t, dur, peak, type = 'triangle', cutoff = 1800) => {
    const o = ctx.createOscillator(); const o2 = ctx.createOscillator(); const g = ctx.createGain(); const f = ctx.createBiquadFilter();
    o.type = type; o2.type = 'sine'; o.frequency.value = freq; o2.frequency.value = freq * 2; o.detune.value = (Math.random() - 0.5) * 12;
    f.type = 'lowpass'; f.frequency.value = cutoff; g.gain.value = 0;
    const g2 = ctx.createGain(); g2.gain.value = 0.18; o2.connect(g2); g2.connect(f); o.connect(f); f.connect(g); g.connect(master);
    env(g, t, 0.02, peak, dur); o.start(t); o2.start(t); o.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
  };
  const pad = (freq, t, dur, peak) => {
    const g = ctx.createGain(); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700; g.gain.value = 0.0001;
    [-7, 0, 7].forEach((c) => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq; o.detune.value = c; o.connect(f); o.start(t); o.stop(t + dur + 0.2); });
    f.connect(g); g.connect(master);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + dur * 0.4); g.gain.linearRampToValueAtTime(0.0001, t + dur);
  };
  const burst = (t, dur, peak, hp, lp, kind = 'white') => {
    const s = ctx.createBufferSource(); s.buffer = noiseBuffer(ctx, Math.max(0.05, dur + 0.05), kind); const g = ctx.createGain(); g.gain.value = 0.0001;
    const f1 = ctx.createBiquadFilter(); f1.type = 'highpass'; f1.frequency.value = hp; const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = lp;
    s.connect(f1); f1.connect(f2); f2.connect(g); g.connect(master); env(g, t, 0.003, peak, dur); s.start(t); s.stop(t + dur + 0.06);
  };
  const kick = (t) => { const o = ctx.createOscillator(); const g = ctx.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14); g.gain.value = 0.0001; o.connect(g); g.connect(master); env(g, t, 0.004, 0.55, 0.22); o.start(t); o.stop(t + 0.3); };

  const vinyl = () => { // continuous dust bed
    const s = track$(ctx.createBufferSource()); s.buffer = noiseBuffer(ctx, 3, 'white'); s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 3200; f.Q.value = 0.6; const g = ctx.createGain(); g.gain.value = 0.012;
    s.connect(f); f.connect(g); g.connect(master); s.start();
  };
  const rumble = (gainV) => { // low fire/air bed
    const s = track$(ctx.createBufferSource()); s.buffer = noiseBuffer(ctx, 4, 'brown'); s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420; const g = ctx.createGain(); g.gain.value = gainV;
    s.connect(f); f.connect(g); g.connect(master); s.start();
  };
  const crackles = (until) => { // random pops
    while (nextCrackle < until) { burst(nextCrackle, 0.025 + Math.random() * 0.04, 0.05 + Math.random() * 0.12, 1500 + Math.random() * 1500, 7000); nextCrackle += 0.04 + Math.random() * (track === 'fireside' ? 0.5 : 2.2); }
  };

  const schedule = () => {
    if (!ctx || !playing) return;
    const horizon = ctx.currentTime + 1.2;
    if (track === 'fireside') { if (nextCrackle < ctx.currentTime) nextCrackle = ctx.currentTime + 0.05; crackles(horizon); return; }
    const st = STYLES[track];
    if (st) {
      const beat = 60 / st.bpm;
      while (nextTime < horizon) {
        const bar = Math.floor(step / 8) % 4; const e = step % 8; const t = nextTime + (e % 2 ? beat * 0.07 : 0); const ch = CHORDS[st.chords][bar];
        if (e === 0 || (st.comp && e === 5)) ch.forEach((m, i) => note(MIDI(m) * (st.wobble ? 1 + Math.sin(t) * 0.002 : 1), t + i * 0.02, beat * (e === 0 ? 3.4 : 1.5), e === 0 ? 0.07 : 0.05, st.wave === 'sawtooth' ? 'sawtooth' : st.wave, st.cut));
        if (st.arp && e % 2 === 1) note(MIDI(ch[(e >> 1) % ch.length] + 12), t, beat * 1.4, 0.04, 'sine', 3200);
        if (st.bass && (e === 0 || e === 6)) note(MIDI(ch[0] - 24), t, beat * 1.6, 0.11, 'sine', 400);
        if (st.drums) {
          if (e === 0 || e === 5) kick(t);
          if (e === 4) burst(t, 0.15, 0.2, 1400, 6000);
          if (e % 2 === 0 || Math.random() < 0.2) burst(t, 0.03, 0.045, 6500, 12000);
        }
        if (st.bed === 'rain' && Math.random() < 0.3) burst(t + Math.random() * beat, 0.02, 0.04, 2500, 9000);
        if (st.bed === 'cafe' && Math.random() < 0.03) note(2400 + Math.random() * 1600, t, 0.25, 0.012, 'sine', 8000); // cup clink
        if (Math.random() < st.mel) note(MIDI(ch[Math.floor(Math.random() * ch.length)] + 12), t + beat * 0.25, beat * 1.2, 0.035, 'sine', 2600);
        nextTime += beat / 2; step += 1;
      }
      return;
    }
    const bpm = track === 'lofi' ? 74 : track === 'night' || track === 'lofi-night' ? 58 : 40; const beat = 60 / bpm;
    while (nextTime < horizon) {
      const bar = Math.floor(step / 8) % 4; const e = step % 8; const sw = e % 2 ? beat * 0.06 : 0; const t = nextTime + sw; // eighth-note grid with swing
      if (track === 'ambient') {
        if (e === 0) CHORDS.ambient[bar].forEach((m) => pad(MIDI(m), t, beat * 7.6, 0.05));
      } else {
        const ch = CHORDS[track === 'lofi' ? 'lofi' : 'night'][bar];
        if (e === 0 || (track === 'lofi' && e === 5)) ch.forEach((m, i) => note(MIDI(m), t + i * 0.018, beat * (e === 0 ? 3.4 : 1.6), e === 0 ? 0.075 : 0.055, 'triangle', 1500));
        if (e === 4 && track === 'night') ch.slice(1).forEach((m, i) => note(MIDI(m + 12), t + i * 0.03, beat * 2, 0.03, 'sine', 2200));
        if (track === 'lofi') {
          if (e === 0 || e === 5) kick(t);
          if (e === 4) burst(t, 0.16, 0.22, 1400, 6500); // snare-ish
          if (e % 2 === 0 || Math.random() < 0.25) burst(t, 0.03, 0.05 + (e % 4 === 0 ? 0.03 : 0), 6500, 12000); // hat
        }
        if (Math.random() < 0.35) note(MIDI(ch[Math.floor(Math.random() * ch.length)] + 12), t + beat * 0.25, beat * 1.2, 0.035, 'sine', 2600); // sparse melody
      }
      nextTime += beat / 2; step += 1;
    }
  };

  const buildBeds = () => {
    if (track === 'lofi' || track === 'night' || track === 'lofi-night') vinyl();
    if (track === 'fireside') rumble(0.28);
    const st = STYLES[track];
    if (st && st.bed === 'vinyl') vinyl();
    if (st && st.bed === 'rain') { const r = track$(ctx.createBufferSource()); r.buffer = noiseBuffer(ctx, 3, 'white'); r.loop = true; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2200; const g = ctx.createGain(); g.gain.value = 0.05; r.connect(f); f.connect(g); g.connect(master); r.start(); }
    if (st && st.bed === 'cafe') { vinyl(); const r = track$(ctx.createBufferSource()); r.buffer = noiseBuffer(ctx, 4, 'brown'); r.loop = true; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 520; f.Q.value = 0.8; const g = ctx.createGain(); g.gain.value = 0.12; r.connect(f); f.connect(g); g.connect(master); r.start(); }
    if (track === 'ambient') rumble(0.05);
  };
  const teardownBeds = () => { nodes.forEach((n) => { try { n.stop && n.stop(); } catch (e) { /* already stopped */ } try { n.disconnect(); } catch (e) { /* gone */ } }); nodes = []; };
  const norm = (id) => (id === 'lofi-night' ? 'night' : id);

  const begin = () => { teardownBeds(); step = 0; nextTime = ctx.currentTime + 0.08; nextCrackle = ctx.currentTime + 0.05; buildBeds(); schedule(); };

  return {
    get playing() { return playing; },
    get state() { return ctx ? ctx.state : 'none'; },
    // Must be called from a user gesture (tap/click)
    async start(id, vol) {
      track = norm(id || track); volume = vol ?? volume;
      if (!ctx) {
        ctx = new AC(); master = ctx.createGain(); master.gain.value = 0; analyser = ctx.createAnalyser(); analyser.fftSize = 512;
        master.connect(analyser); analyser.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') await ctx.resume();
      playing = true; begin(); clearInterval(timer); timer = setInterval(schedule, 250);
      master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setValueAtTime(master.gain.value, ctx.currentTime); master.gain.linearRampToValueAtTime(volume * 0.9, ctx.currentTime + 0.6);
    },
    setTrack(id) { track = norm(id); if (playing && ctx) begin(); },
    // Smooth change (auto-rotate): fade the mix down, swap the track at the bottom, fade back up to the saved volume. ~2.4s total.
    crossfadeTo(id, secs = 2.4) {
      if (!playing || !ctx) { track = norm(id); return; }
      const half = secs / 2; const t0 = ctx.currentTime;
      master.gain.cancelScheduledValues(t0); master.gain.setValueAtTime(master.gain.value, t0); master.gain.linearRampToValueAtTime(0.0001, t0 + half);
      setTimeout(() => {
        if (!playing || !ctx) return;
        track = norm(id); begin(); const t1 = ctx.currentTime;
        master.gain.cancelScheduledValues(t1); master.gain.setValueAtTime(0.0001, t1); master.gain.linearRampToValueAtTime(volume * 0.9, t1 + half);
      }, half * 1000);
    },
    setVolume(v) { volume = v; if (ctx && master) { master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setValueAtTime(master.gain.value, ctx.currentTime); master.gain.setTargetAtTime(v * 0.9, ctx.currentTime, 0.05); } },
    // Fade out, clear timers, free the audio context
    async stop() {
      if (!ctx) { playing = false; return; }
      playing = false; clearInterval(timer); timer = 0;
      const c = ctx; const m = master;
      try { m.gain.cancelScheduledValues(c.currentTime); m.gain.setValueAtTime(m.gain.value, c.currentTime); m.gain.linearRampToValueAtTime(0.0001, c.currentTime + 0.25); } catch (e) { /* closed */ }
      await new Promise((r) => setTimeout(r, 300));
      teardownBeds(); ctx = null; master = null; analyser = null;
      try { await c.close(); } catch (e) { /* already closed */ }
    },
    // 0..1 loudness of what is actually being output (used for the "is it making sound" check)
    level() { if (!analyser) return 0; analyser.getByteTimeDomainData(data); let s = 0; for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; s += v * v; } return Math.sqrt(s / data.length); },
  };
};
