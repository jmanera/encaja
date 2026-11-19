// Encaja: música original, sintetizada con Web Audio (melodía, bajo y percusión).
// Cada canción es una lista de compases de 16 pasos (semicorcheas): [nota, pasos].
(function () {
  'use strict';

  const TUNES = {
    paseo: {
      name: 'Paseo', bpm: 128,
      melody: [
        [['A4', 2], ['E5', 2], ['D5', 2], ['C5', 2], ['B4', 2], ['C5', 2], ['A4', 4]],
        [['G4', 2], ['B4', 2], ['D5', 2], ['B4', 2], ['C5', 4], ['-', 4]],
        [['F4', 2], ['A4', 2], ['C5', 2], ['F5', 2], ['E5', 2], ['D5', 2], ['C5', 4]],
        [['B4', 2], ['G4', 2], ['B4', 2], ['D5', 2], ['E5', 6], ['-', 2]],
        [['A5', 2], ['G5', 2], ['E5', 2], ['C5', 2], ['D5', 2], ['E5', 2], ['A4', 4]],
        [['F5', 2], ['E5', 2], ['D5', 2], ['B4', 2], ['C5', 4], ['A4', 4]],
        [['D5', 2], ['F5', 2], ['E5', 2], ['C5', 2], ['B4', 2], ['G4', 2], ['E5', 4]],
        [['A4', 4], ['C5', 2], ['B4', 2], ['A4', 6], ['-', 2]],
      ],
      bass: ['A2', 'G2', 'F2', 'E2', 'A2', 'D2', 'G2', 'A2'],
      drums: 'k.h.s.h.k.hks.h.',
    },
    nieve: {
      name: 'Nieve', bpm: 96,
      melody: [
        [['E5', 4], ['G5', 2], ['E5', 2], ['D5', 4], ['C5', 4]],
        [['D5', 2], ['E5', 2], ['F5', 2], ['D5', 2], ['G4', 8]],
        [['C5', 4], ['E5', 2], ['G5', 2], ['A5', 4], ['G5', 4]],
        [['F5', 2], ['E5', 2], ['D5', 2], ['E5', 2], ['C5', 8]],
        [['E5', 4], ['G5', 2], ['E5', 2], ['D5', 4], ['C5', 4]],
        [['D5', 2], ['E5', 2], ['F5', 2], ['A5', 2], ['G5', 8]],
        [['A5', 4], ['G5', 2], ['E5', 2], ['F5', 4], ['D5', 4]],
        [['D5', 2], ['F5', 2], ['E5', 2], ['D5', 2], ['C5', 8]],
      ],
      bass: ['C3', 'G2', 'A2', 'F2', 'C3', 'G2', 'F2', 'C3'],
      drums: 'k.......s.......',
    },
    prisa: {
      name: 'Prisa', bpm: 150,
      melody: [
        [['E5', 1], ['-', 1], ['B4', 1], ['E5', 1], ['G5', 2], ['F#5', 2], ['E5', 2], ['D5', 2], ['B4', 4]],
        [['C5', 2], ['D5', 2], ['E5', 2], ['C5', 2], ['A4', 4], ['B4', 4]],
        [['E5', 1], ['-', 1], ['B4', 1], ['E5', 1], ['G5', 2], ['A5', 2], ['B5', 2], ['A5', 2], ['G5', 4]],
        [['F#5', 2], ['E5', 2], ['D#5', 2], ['F#5', 2], ['E5', 8]],
      ],
      bass: ['E2', 'A2', 'E2', 'B2'],
      drums: 'k.hsk.hsk.hsk.ss',
    },
  };

  const SEMI = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
  function freq(n) {
    const m = /^([A-G]#?)(\d)$/.exec(n);
    return 440 * Math.pow(2, (SEMI[m[1]] + (+m[2] + 1) * 12 - 69) / 12);
  }

  let ac = null, out = null, tune = null, timer = 0, nextT = 0, step = 0, tempo = 1, noise = null;
  // eventos de la canción ya calculados: por paso, lo que suena
  let score = [];

  function compile(T) {
    const bars = T.melody.length, list = Array.from({ length: bars * 16 }, () => []);
    T.melody.forEach((bar, b) => {
      let s = 0;
      for (const [n, len] of bar) { if (n !== '-') list[b * 16 + s].push({ k: 'mel', f: freq(n), len }); s += len; }
    });
    for (let b = 0; b < bars; b++) {
      const root = freq(T.bass[b % T.bass.length]);
      for (let s = 0; s < 16; s += 2) list[b * 16 + s].push({ k: 'bass', f: s % 4 ? root * 2 : root, len: 2 });
      for (let s = 0; s < 16; s++) { const d = T.drums[s]; if (d !== '.') list[b * 16 + s].push({ k: d }); }
    }
    return list;
  }

  function play(ev, t, stepDur) {
    if (ev.k === 'mel' || ev.k === 'bass') {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = ev.k === 'mel' ? 'square' : 'triangle';
      o.frequency.value = ev.f;
      const d = ev.len * stepDur * 0.9, v = ev.k === 'mel' ? 0.05 : 0.09;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + 0.01);
      g.gain.exponentialRampToValueAtTime(v * 0.6, t + d * 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(out); o.start(t); o.stop(t + d + 0.02);
    } else if (ev.k === 'k') {
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      o.connect(g).connect(out); o.start(t); o.stop(t + 0.16);
    } else {
      const src = ac.createBufferSource(), g = ac.createGain(), f = ac.createBiquadFilter();
      src.buffer = noise; f.type = ev.k === 'h' ? 'highpass' : 'bandpass'; f.frequency.value = ev.k === 'h' ? 7000 : 1800;
      const d = ev.k === 'h' ? 0.04 : 0.12, v = ev.k === 'h' ? 0.035 : 0.09;
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      src.connect(f).connect(g).connect(out); src.start(t); src.stop(t + d + 0.01);
    }
  }

  function tick() {
    if (!tune) return;
    const stepDur = 60 / (tune.bpm * tempo) / 4;
    while (nextT < ac.currentTime + 0.15) {
      for (const ev of score[step]) play(ev, nextT, stepDur);
      nextT += stepDur;
      step = (step + 1) % score.length;
    }
  }

  function start(audio, id) {
    stop();
    ac = audio;
    if (!ac || !TUNES[id]) return;
    if (!noise) {
      noise = ac.createBuffer(1, ac.sampleRate * 0.2, ac.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    out = ac.createGain(); out.gain.value = 0.8; out.connect(ac.destination);
    tune = TUNES[id]; score = compile(tune); step = 0; nextT = ac.currentTime + 0.05;
    timer = setInterval(tick, 40);
    tick();
  }
  function stop() {
    clearInterval(timer); timer = 0; tune = null;
    if (out) { try { out.gain.setTargetAtTime(0, ac.currentTime, 0.05); const o = out; setTimeout(() => o.disconnect(), 300); } catch (e) { /* ya cerrado */ } out = null; }
  }
  // la música se acelera un poco al subir de nivel
  function setTempo(k) { tempo = k; }
  const playing = () => !!tune;

  window.ENMusica = { TUNES, start, stop, setTempo, playing };
})();
