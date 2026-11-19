// @ts-nocheck — Web Audio generators (client only)

  let ctx = null, master = null, noiseBuf = null;
  const live = { hiss: null, oars: null, sea: null };
  let muted = (() => { try { return JSON.parse(localStorage.getItem('le.muted') || 'false'); } catch (e) { return false; } })();

  function boot() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }
  function noise() { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; return s; }

  function startHiss(level = 0.035) {
    if (!boot() || live.hiss) return;
    const src = noise();
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2400;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 9000;
    const g = ctx.createGain(); g.gain.value = 0;
    g.gain.linearRampToValueAtTime(level, ctx.currentTime + 0.4);
    src.connect(hp).connect(lp).connect(g).connect(master);
    src.start();
    // tape wow: slow wobble on the hiss level
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.6;
    const lg = ctx.createGain(); lg.gain.value = level * 0.25;
    lfo.connect(lg).connect(g.gain); lfo.start();
    live.hiss = { src, g, lfo };
  }
  function stopHiss() {
    const h = live.hiss; if (!h) return;
    h.g.gain.cancelScheduledValues(ctx.currentTime);
    h.g.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
    setTimeout(() => { try { h.src.stop(); h.lfo.stop(); } catch (e) { /* */ } }, 600);
    live.hiss = null;
  }

  // one oar stroke: blade catching water + a dull wooden knock
  function stroke(t, vol = 0.32) {
    const src = noise();
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.8;
    bp.frequency.setValueAtTime(1100, t); bp.frequency.exponentialRampToValueAtTime(380, t + 0.9);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
    src.connect(bp).connect(g).connect(master);
    src.start(t); src.stop(t + 1.4);
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.18);
    const og = ctx.createGain(); og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(vol * 0.7, t + 0.01);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(og).connect(master); o.start(t); o.stop(t + 0.25);
  }
  function startOars(vol = 0.3) {
    if (!boot() || live.oars) return;
    let next = ctx.currentTime + 0.3;
    const tick = () => {
      while (next < ctx.currentTime + 1.5) {
        stroke(next, vol);
        // felt, not only heard: foreground oars pulse the phone in time with each stroke
        if (vol >= 0.2 && audio.onStroke) setTimeout(audio.onStroke, Math.max(0, (next - ctx.currentTime) * 1000));
        next += 4;
      }
    };
    tick();
    live.oars = setInterval(tick, 500);
  }
  function stopOars() { if (live.oars) { clearInterval(live.oars); live.oars = null; } }

  function burstStatic(seconds = 9, level = 0.18) {
    if (!boot()) return;
    const src = noise();
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.3;
    const g = ctx.createGain(); const t = ctx.currentTime;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(level, t + 0.05);
    g.gain.setValueAtTime(level, t + seconds - 0.1); g.gain.linearRampToValueAtTime(0, t + seconds);
    src.connect(bp).connect(g).connect(master); src.start(t); src.stop(t + seconds + 0.1);
  }

  function startSea(level = 0.06) {
    if (!boot() || live.sea) return;
    const src = noise();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
    const g = ctx.createGain(); g.gain.value = level;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.09;
    const lg = ctx.createGain(); lg.gain.value = level * 0.8;
    lfo.connect(lg).connect(g.gain);
    src.connect(lp).connect(g).connect(master); src.start(); lfo.start();
    live.sea = { src, lfo, g };
  }
  function stopSea() { const s = live.sea; if (!s) return; try { s.src.stop(); s.lfo.stop(); } catch (e) { /* */ } live.sea = null; }

  // short paper / stamp thud for UI
  function thud() {
    if (!boot()) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(60, t + 0.12);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g).connect(master); o.start(t); o.stop(t + 0.18);
    const src = noise(); const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.12, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    src.connect(ng).connect(master); src.start(t); src.stop(t + 0.1);
  }

  // continuous radio static whose level can be changed (frequency locks)
  let radio = null;
  function setStatic(level) {
    if (!boot()) return;
    if (!radio) {
      const src = noise();
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1600; bp.Q.value = 0.4;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(bp).connect(g).connect(master); src.start();
      radio = { src, g };
    }
    radio.g.gain.setTargetAtTime(Math.max(0, Math.min(0.25, level)), ctx.currentTime, 0.08);
  }
  function stopStatic() { if (!radio) return; try { radio.src.stop(); } catch (e) { /* */ } radio = null; }
  function tone(freq = 440, dur = 0.12, vol = 0.12) {
    if (!boot()) return;
    const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = freq; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.02);
  }

  /** The station jingle: five piano notes, four up and one down. */
  function jingle() {
    if (!boot()) return;
    const notes = [523.25, 659.25, 783.99, 1046.5, 880];
    notes.forEach((f, i) => {
      const t = ctx.currentTime + 0.25 + i * 0.32;
      [1, 2, 3].forEach((h, k) => { // a few partials, quick decay: reads as an old upright piano
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = k ? 'sine' : 'triangle'; o.frequency.value = f * h;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime((0.16 / h) * (i === 4 ? 1.1 : 1), t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + (i === 4 ? 1.6 : 0.7));
        o.connect(g).connect(master); o.start(t); o.stop(t + 1.7);
      });
    });
  }

  export const audio = {
    setStatic, stopStatic, tone, jingle,
    onStroke: null as null | (() => void),
    boot, startHiss, stopHiss, startOars, stopOars, burstStatic, startSea, stopSea, thud,
    stopAll() { stopHiss(); stopOars(); stopSea(); },
    get muted() { return muted; },
    setMuted(v) {
      muted = v; try { localStorage.setItem('le.muted', JSON.stringify(v)); } catch (e) { /* */ }
      if (master) master.gain.setTargetAtTime(v ? 0 : 0.9, ctx.currentTime, 0.05);
    },
  };
