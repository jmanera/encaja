// Encaja: bucle del juego, controles, menús, sonidos, récords y partida guardada.
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const D = ENDibujo, MU = ENMusica, TEMAS = window.ENTemas;
  const { Game, MODES, COLS, VISIBLE, HIDDEN, TYPES } = ENMotor;

  // ---------- Ajustes y récords ----------
  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } };
  const drop = k => { try { localStorage.removeItem(k); } catch (e) { /* sin almacenamiento */ } };
  const cfg = Object.assign({ mode: 'maraton', tema: 'caramelos', startLevel: 1, sound: true, music: true, marks: true,
    pad: false, vibrate: true, speed: 'normal' }, load('en.cfg', {}));
  const records = load('en.records', {}); // {modo: [{score, lines, level, time, date}]}
  const temaOf = id => TEMAS.find(t => t.id === id) || TEMAS[0];
  const SPEEDS = { lenta: { name: 'Lenta', das: 0.22, arr: 0.05 }, normal: { name: 'Normal', das: 0.167, arr: 0.033 }, rapida: { name: 'Rápida', das: 0.12, arr: 0.016 } };
  const TUNE_OF = { maraton: 'paseo', infinito: 'paseo', sprint: 'prisa', ultra: 'prisa', diario: 'prisa', zen: 'nieve' };

  // ---------- Partida ----------
  let G = null, T = temaOf(cfg.tema);
  let paused = false, modalOpen = false, playing = false;
  let boardImg = null, boardKey = '', boardVer = 0;
  let sparks = [], popups = [], flashes = [], rowFlash = [], shake = 0, collapsed = false, ambient = null;

  function makeGame(mode) {
    const S = SPEEDS[cfg.speed] || SPEEDS.normal;
    const M = MODES[mode];
    return new Game({ mode, startLevel: cfg.startLevel, seed: M.daily ? ENMotor.dailySeed() : undefined, das: S.das, arr: S.arr });
  }
  function newGame(start) {
    T = temaOf(cfg.tema);
    G = makeGame(cfg.mode);
    reset();
    playing = !!start;
    paused = false;
    if (start) { beepSeq([[523, 0.08], [659, 0.08], [784, 0.14]], 0.1); saveGame(); }
    hud();
  }
  function reset() {
    boardVer++; sparks = []; popups = []; flashes = []; rowFlash = []; shake = 0; collapsed = false;
    MU.stop();
  }

  // partida guardada al salir o pausar, para seguirla luego
  function saveGame() { if (G && playing && G.phase !== 'over') save('en.save', { g: G.toJSON(), tema: cfg.tema, at: Date.now() }); }
  function savedGame() { const s = load('en.save', null); return s && s.g && MODES[s.g.mode] ? s : null; }
  function resumeSaved() {
    const s = savedGame();
    if (!s) return;
    const S = SPEEDS[cfg.speed] || SPEEDS.normal;
    G = Game.from(s.g, { das: S.das, arr: S.arr });
    cfg.mode = G.mode; cfg.tema = s.tema || cfg.tema; save('en.cfg', cfg);
    T = temaOf(cfg.tema);
    reset();
    playing = true; paused = true;
    layout(); hud();
  }

  // ---------- Geometría ----------
  const cv = $('cv'), ctx = cv.getContext('2d');
  let geo = null;
  const SIDE = 5; // casillas de ancho de los paneles laterales
  function layout() {
    document.documentElement.style.setProperty('--bg', T.colores.fondo);
    const r = $('stage').getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
    const units = COLS + SIDE * 2 + 0.8, rows = VISIBLE + 1.6;
    const cs = Math.floor(Math.min((r.width - 16) / units, (r.height - 12) / rows));
    if (cs < 6) { geo = null; return; }
    const bw = COLS * cs, bh = VISIBLE * cs;
    const bx = Math.round((r.width - bw) / 2), by = Math.round((r.height - bh) / 2 + cs * 0.5);
    geo = { cs, bx, by, bw, bh, dpr, w: r.width, h: r.height };
    boardKey = '';
    ambient = D.makeAmbient(T.particulas, r.width, r.height);
  }

  // ---------- Dibujo ----------
  function draw(dt) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = T.colores.fondo; ctx.fillRect(0, 0, cv.width, cv.height);
    if (!G || !geo) return;
    const { cs, bw, bh, dpr } = geo, t = performance.now() / 1000;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    D.ambient(ctx, ambient, dt);
    shake = Math.max(0, shake - dt * 3);
    const sx = shake ? (Math.random() - 0.5) * shake * cs * 0.25 : 0, sy = shake ? Math.random() * shake * cs * 0.3 : 0;
    const bx = geo.bx + sx, by = geo.by + sy;

    // marco y tablero
    ctx.save();
    ctx.shadowColor = T.colores.borde; ctx.shadowBlur = T.estilo === 'neon' ? cs * 0.6 : 0;
    ctx.fillStyle = T.colores.borde;
    ctx.beginPath(); D.roundRect(ctx, bx - cs * 0.18, by - cs * 0.18, bw + cs * 0.36, bh + cs * 0.36, cs * 0.35); ctx.fill();
    ctx.restore();
    const key = `${T.id}|${cs}|${dpr}|${boardVer}|${collapsed}`;
    if (key !== boardKey) {
      boardImg = D.boardCanvas(collapsed ? { cells: [], ids: [] } : G, T, cs, dpr);
      boardKey = key;
    }
    ctx.save();
    ctx.beginPath(); D.roundRect(ctx, bx, by, bw, bh, cs * 0.22); ctx.clip();
    ctx.drawImage(boardImg, bx, by, bw, bh);
    // filas que se acaban de borrar
    rowFlash = rowFlash.filter(f => (f.t -= dt) > 0);
    for (const f of rowFlash) {
      ctx.fillStyle = `rgba(255,255,255,${f.t / 0.35 * 0.7})`;
      ctx.fillRect(bx, by + (f.y - HIDDEN) * cs - cs * (0.35 - f.t), bw, cs * (1 + 2 * (0.35 - f.t)));
    }
    ctx.restore();

    if (paused) { panels(bx, by, t, true); overlay('EN PAUSA', T.colores.texto, 'Toca para seguir'); return; }

    // pieza actual y marcas de aterrizaje
    const p = G.cur;
    if (p && G.phase === 'play') {
      const ly = G.dropY(p);
      if (cfg.marks && ly > p.y) D.landing(ctx, T, G.blocks(p, p.r, p.x, ly), cs, bx, by, t);
      // bajada suave entre filas
      let fy = p.y;
      if (G.fits(p, p.r, p.x, p.y + 1)) {
        const g = ENMotor.gravity(G.M.zen ? 1 : G.level);
        const step = G.s.soft ? Math.min(g / 20, 0.033) : g;
        fy += Math.min(0.95, p.fallT / step);
      }
      const cells = ENMotor.SHAPES[p.t].states[p.r].map(([x, y]) => [x, y]);
      ctx.save();
      ctx.beginPath(); ctx.rect(bx - cs, by - cs * 2.2, bw + cs * 2, bh + cs * 2.2); ctx.clip();
      // la pieza se va apagando mientras está apoyada a punto de fijarse
      const alpha = ly === p.y ? 1 - 0.35 * Math.min(1, p.lockT / 0.5) : 1;
      D.piece(ctx, T, p.t, cells, cs, bx + p.x * cs, by + (fy - HIDDEN) * cs, alpha);
      ctx.restore();
    }
    // destello al encajar
    flashes = flashes.filter(f => (f.t -= dt) > 0);
    for (const f of flashes) {
      ctx.save(); ctx.globalAlpha = f.t / 0.18 * 0.7; ctx.fillStyle = '#ffffff';
      ctx.beginPath(); D.shapePath(ctx, f.cells, cs, bx, by, cs * 0.05, cs * 0.2); ctx.fill(); ctx.restore();
    }

    panels(bx, by, t, false);
    D.sparks(ctx, sparks, dt);

    // textos de jugada
    popups = popups.filter(q => (q.t -= dt) > 0);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let py = by + bh * 0.38;
    for (const q of popups) {
      const k = Math.min(1, (1.6 - q.t) * 6);
      ctx.save();
      ctx.globalAlpha = Math.min(1, q.t * 2.5);
      ctx.translate(bx + bw / 2, py - (1.6 - q.t) * cs * 0.8);
      ctx.scale(0.6 + 0.4 * k, 0.6 + 0.4 * k);
      ctx.font = `900 ${Math.round(cs * q.size)}px system-ui, sans-serif`;
      ctx.lineWidth = cs * 0.22; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineJoin = 'round';
      ctx.strokeText(q.text, 0, 0); ctx.fillStyle = q.color; ctx.fillText(q.text, 0, 0);
      ctx.restore();
      py += cs * q.size * 1.25;
    }

    if (G.phase === 'ready') overlay(G.s.phaseT > 0.45 ? '¡PREPARADOS!' : '¡YA!', T.colores.acento);
  }

  function panels(bx, by, t, dim) {
    const { cs, bw } = geo;
    const lx = bx - cs * (SIDE + 0.4), rx = bx + bw + cs * 0.4, pw = cs * SIDE;
    const box = (x, y, w, h, title) => {
      ctx.fillStyle = T.colores.panel; ctx.beginPath(); D.roundRect(ctx, x, y, w, h, cs * 0.3); ctx.fill();
      ctx.fillStyle = T.colores.texto; ctx.globalAlpha = 0.7;
      ctx.font = `800 ${Math.round(cs * 0.42)}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(title, x + w / 2, y + cs * 0.5); ctx.globalAlpha = 1;
    };
    // pieza guardada
    box(lx, by, pw, cs * 3.6, 'GUARDADA');
    if (G.hold && !dim) D.mini(ctx, T, G.hold, lx + pw / 2, by + cs * 2.15, cs * 0.85, G.s.holdUsed ? 0.35 : 1);
    // siguientes
    const nh = cs * 1.2 + cs * 2.4 + cs * 1.9 * 4;
    box(rx, by, pw, nh, 'SIGUIENTES');
    if (!dim) {
      G.queue.slice(0, 5).forEach((tp, k) => {
        const y = k === 0 ? by + cs * 2.2 : by + cs * 3.7 + (k - 0.5) * cs * 1.9;
        D.mini(ctx, T, tp, rx + pw / 2, y, k === 0 ? cs * 0.9 : cs * 0.62);
      });
    }
    // información del modo
    let y = by + cs * 4.1;
    const info = (label, value, big) => {
      ctx.fillStyle = T.colores.panel; ctx.beginPath(); D.roundRect(ctx, lx, y, pw, cs * (big ? 2.4 : 1.9), cs * 0.3); ctx.fill();
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = T.colores.texto; ctx.globalAlpha = 0.7; ctx.font = `800 ${Math.round(cs * 0.36)}px system-ui, sans-serif`;
      ctx.fillText(label, lx + pw / 2, y + cs * 0.45); ctx.globalAlpha = 1;
      ctx.fillStyle = big ? T.colores.acento : T.colores.texto;
      ctx.font = `900 ${Math.round(cs * (big ? 1.05 : 0.75))}px system-ui, sans-serif`;
      ctx.fillText(value, lx + pw / 2, y + cs * (big ? 1.5 : 1.25));
      y += cs * (big ? 2.7 : 2.2);
    };
    const M = G.M;
    if (M.time) info('QUEDA', fmtTime(G.left, false), true);
    if (M.lines && M.byTime) info('FALTAN', Math.max(0, M.lines - G.lines), true);
    if (G.mode === 'maraton') info('META', `${G.lines}/${M.lines}`);
    info('PIEZAS', G.s.pieces);
    if (G.s.combo > 0) info('COMBO', '×' + G.s.combo);
    if (G.s.b2b) info('RACHA', '×1,5');
  }

  function overlay(text, color, sub) {
    const { cs, bx, by, bw, bh } = geo;
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.beginPath(); D.roundRect(ctx, bx, by, bw, bh, cs * 0.22); ctx.fill();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `900 ${Math.round(cs * 1.05)}px system-ui, sans-serif`;
    ctx.lineWidth = cs * 0.25; ctx.strokeStyle = 'rgba(0,0,0,.75)'; ctx.lineJoin = 'round';
    ctx.strokeText(text, bx + bw / 2, by + bh * 0.42);
    ctx.fillStyle = color; ctx.fillText(text, bx + bw / 2, by + bh * 0.42);
    if (sub) { ctx.font = `700 ${Math.round(cs * 0.5)}px system-ui, sans-serif`; ctx.fillStyle = T.colores.texto; ctx.fillText(sub, bx + bw / 2, by + bh * 0.42 + cs * 1.1); }
  }

  // ---------- Bucle ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (G && playing && !paused && !modalOpen) {
      let rest = dt;
      while (rest > 1e-4) {
        const st = Math.min(rest, 1 / 120);
        G.update(st);
        rest -= st;
      }
    }
    if (G) handle(G.takeEvents());
    draw(dt);
    requestAnimationFrame(frame);
  }

  const cellCenter = (x, y) => [geo.bx + (x + 0.5) * geo.cs, geo.by + (y - HIDDEN + 0.5) * geo.cs];
  function popup(text, color, size) {
    popups.push({ text, color: color || T.colores.texto, size: size || 0.9, t: 1.6 });
    if (popups.length > 4) popups.shift();
  }
  const LINE_TXT = ['', '', '¡DOBLE!', '¡TRIPLE!', '¡ENCAJE!'];

  function handle(events) {
    if (!events.length) return;
    let lockedNow = false;
    for (const ev of events) {
      switch (ev.type) {
        case 'go': MU.setTempo(1); if (cfg.music && cfg.sound && ac()) MU.start(audio, TUNE_OF[G.mode]); beep(1047, 0.15, 0, 'square', 0.06); break;
        case 'move': beep(220, 0.02, 0, 'square', 0.015); break;
        case 'rotate': beep(520, 0.03, 0, 'triangle', 0.04); break;
        case 'hold': sweep(600, 300, 0.12, 0.05); break;
        case 'hardDrop':
          shake = Math.min(1, 0.4 + ev.rows / 22);
          noiseHit(0.09, 0.12);
          break;
        case 'lock': {
          lockedNow = true;
          boardVer++;
          const vis = ev.blocks.filter(([, y]) => y >= HIDDEN).map(([x, y]) => [x, y - HIDDEN]);
          flashes.push({ cells: vis, t: 0.18 });
          if (geo) {
            // polvo bajo la pieza
            const bottom = Math.max(...ev.blocks.map(b => b[1]));
            for (const [x, y] of ev.blocks) if (y === bottom) { const [cx, cy] = cellCenter(x, y); D.burst(sparks, cx, cy + geo.cs * 0.45, 'rgba(255,255,255,.5)', 2, geo.cs * 1.2, 'polvo'); }
          }
          beep(140, 0.06, 0, 'triangle', 0.1);
          break;
        }
        case 'clear': {
          if (ev.lines) {
            if (geo) {
              ev.rows.forEach((y, k) => {
                rowFlash.push({ y, t: 0.35 });
                for (let x = 0; x < COLS; x++) {
                  const [cx, cy] = cellCenter(x, y);
                  const v = ev.cells[k][x], col = TYPES[v - 1] ? T.piezas[TYPES[v - 1]] : T.confeti[0];
                  D.burst(sparks, cx, cy, col, 2, geo.cs * 6, 'confeti');
                  D.burst(sparks, cx, cy, T.confeti[(x + k) % T.confeti.length], 1, geo.cs * 7, 'confeti');
                }
              });
            }
            const base = [0, 523, 587, 659, 784][ev.lines];
            beepSeq(Array.from({ length: ev.lines + 1 }, (_, k) => [base * Math.pow(1.26, k), 0.07]), 0.06);
            if (ev.lines === 4) beepSeq([[784, 0.08], [988, 0.08], [1175, 0.08], [1568, 0.25]], 0.08);
            vibrate(ev.lines === 4 ? [30, 40, 60] : 25);
          }
          if (ev.spin) {
            const w = ['', ' SENCILLO', ' DOBLE', ' TRIPLE'][ev.lines] || '';
            popup((ev.spin === 'mini' ? 'MINIGIRO' : '¡GIRO') + w + (ev.spin === 'mini' ? '' : '!'), '#ffe066', ev.lines ? 0.85 : 0.7);
            beepSeq([[1319, 0.05], [1760, 0.05], [2093, 0.1]], 0.05);
          } else if (ev.lines >= 2) popup(LINE_TXT[ev.lines], ev.lines === 4 ? T.colores.acento : T.colores.texto, ev.lines === 4 ? 1.3 : 1);
          if (ev.b2b) popup('¡EN RACHA!', '#ffa94d', 0.6);
          if (ev.combo > 0) popup(`COMBO ×${ev.combo}`, '#74c0fc', 0.6);
          if (ev.clean) { popup('¡TABLERO LIMPIO!', '#8ce99a', 0.75); beepSeq([[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.1], [1319, 0.3]], 0.09); }
          if (ev.points && (ev.lines >= 2 || ev.spin || ev.combo > 0 || ev.clean)) popup('+' + ev.points, '#ffffff', 0.55);
          boardVer++;
          break;
        }
        case 'level':
          popup(`NIVEL ${ev.level}`, T.colores.acento, 0.85);
          MU.setTempo(Math.min(1.3, 1 + (ev.level - G.s.startLevel) * 0.02));
          beepSeq([[659, 0.08], [784, 0.08], [988, 0.08], [1319, 0.18]], 0.08);
          break;
        case 'zenReset': collapse(); setTimeout(() => { collapsed = false; boardVer++; }, 700); toast('Tablero vacío: sigue jugando'); break;
        case 'over': collapse(); sweep(500, 70, 1.2, 0.08); finish(); break;
        case 'win': finish(); beepSeq([[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.1], [784, 0.1], [1047, 0.35]], 0.11); break;
      }
    }
    if (lockedNow) saveGame();
    hud();
  }

  // al perder, las piezas se derrumban
  function collapse() {
    if (!geo) return;
    for (let y = HIDDEN; y < G.cells.length; y++) for (let x = 0; x < COLS; x++) {
      const v = G.cells[y][x];
      if (!v) continue;
      const [cx, cy] = cellCenter(x, y);
      sparks.push({ x: cx, y: cy, vx: (Math.random() - 0.5) * geo.cs * 6, vy: -Math.random() * geo.cs * 6, life: 0, max: 1.2 + Math.random() * 0.8,
        color: T.piezas[TYPES[v - 1]] || '#888', s: geo.cs * 0.8, rot: 0, vr: (Math.random() - 0.5) * 8, kind: 'bloque' });
    }
    collapsed = true; boardVer++;
    shake = 1;
  }

  // ---------- Marcador ----------
  function fmtTime(s, cents) {
    s = Math.max(0, s);
    const m = Math.floor(s / 60), r = s - m * 60;
    return cents ? `${m}:${r.toFixed(2).padStart(5, '0')}` : `${m}:${String(Math.floor(r)).padStart(2, '0')}`;
  }
  function hud() {
    if (!G) return;
    $('sScore').textContent = G.score;
    $('sLines').textContent = G.M.lines && G.M.byTime ? `${G.lines}/${G.M.lines}` : G.lines;
    $('sLevel').textContent = G.M.levels ? G.level : '–';
    const timed = !!G.M.time;
    $('sTimeL').textContent = timed ? 'Queda' : 'Tiempo';
  }
  setInterval(() => { if (G) $('sTime').textContent = G.M.time ? fmtTime(G.left) : fmtTime(G.time, G.M.byTime); }, 50);

  // ---------- Fin de partida y récords ----------
  const better = (mode, a, b) => (MODES[mode].byTime ? a.time - b.time : b.score - a.score);
  function finish() {
    playing = false;
    drop('en.save');
    MU.stop();
    const mode = G.mode, M = MODES[mode], won = G.s.result === 'win' || G.s.result === 'time';
    const entry = { score: G.score, lines: G.lines, level: G.level, time: G.time, date: new Date().toISOString().slice(0, 10) };
    let pos = -1;
    const counts = !M.zen && (!M.byTime || G.s.result === 'win') && (G.score > 0 || G.lines > 0);
    if (counts) {
      const list = records[mode] = records[mode] || [];
      list.push(entry);
      list.sort((a, b) => better(mode, a, b));
      pos = list.indexOf(entry);
      records[mode] = list.slice(0, 5);
      save('en.records', records);
    }
    const best = records[mode] && records[mode][0];
    const title = M.byTime ? (won ? `¡${M.lines} líneas!` : 'Fin de la partida')
      : G.s.result === 'time' ? '¡Tiempo!' : G.s.result === 'win' ? '¡Maratón completado!' : 'Fin de la partida';
    const recTxt = pos === 0 ? '<em>¡Nuevo récord!</em>' : pos > 0 && pos < 5 ? `<em>Puesto ${pos + 1}</em>` : '';
    const c = G.s.counts;
    setTimeout(() => {
      sheet(`<h2>${title}</h2>
        <div class="res">
          ${M.byTime ? `<div><b>${fmtTime(G.time, true)}</b><small>Tiempo</small>${recTxt}</div>` : `<div><b>${G.score}</b><small>Puntos</small>${recTxt}</div>`}
          <div><b>${G.lines}</b><small>Líneas</small></div>
          ${M.levels ? `<div><b>${G.level}</b><small>Nivel</small></div>` : ''}
          ${M.byTime ? `<div><b>${G.score}</b><small>Puntos</small></div>` : `<div><b>${fmtTime(G.time)}</b><small>Tiempo</small></div>`}
          <div><b>${(G.s.pieces / Math.max(1, G.time)).toFixed(2)}</b><small>Piezas/seg</small></div>
          <div><b>${c.quad}</b><small>Encajes (4)</small></div>
          <div><b>${c.spins}</b><small>Giros</small></div>
          <div><b>${G.s.maxCombo > 0 ? G.s.maxCombo : 0}</b><small>Combo máx.</small></div>
          ${best && pos !== 0 ? `<div><b>${M.byTime ? fmtTime(best.time, true) : best.score}</b><small>Récord</small></div>` : ''}
        </div>
        <div class="row-btns center"><button class="btn" data-a="start">Cambiar modo o tema</button>
        <button class="btn primary big" data-a="again">Otra partida</button></div>`);
    }, 1300);
    hud();
  }

  // ---------- Controles ----------
  const act = () => G && playing && !paused && !modalOpen;
  function doCmd(c) {
    if (!act()) return;
    if (c === 'cw') G.rotate(1);
    else if (c === 'ccw') G.rotate(-1);
    else if (c === 'flip') G.rotate(2);
    else if (c === 'hard') G.hardDrop();
    else if (c === 'hold') G.holdPiece();
  }
  const KEYDOWN = { ArrowUp: 'cw', x: 'cw', X: 'cw', z: 'ccw', Z: 'ccw', Control: 'ccw', a: 'flip', A: 'flip', ' ': 'hard', c: 'hold', C: 'hold', Shift: 'hold' };
  document.addEventListener('keydown', e => {
    if (modalOpen) { if (e.key === 'Escape' && playing) action('resume'); return; }
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') { if (playing) setPause(!paused); e.preventDefault(); return; }
    if (paused && playing) { setPause(false); e.preventDefault(); return; }
    if (!act()) return;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { if (!e.repeat) G.press(e.key === 'ArrowLeft' ? 'left' : 'right'); e.preventDefault(); return; }
    if (e.key === 'ArrowDown') { G.setSoft(true); e.preventDefault(); return; }
    if (KEYDOWN[e.key] && !e.repeat) { doCmd(KEYDOWN[e.key]); e.preventDefault(); }
  });
  document.addEventListener('keyup', e => {
    if (!G) return;
    if (e.key === 'ArrowLeft') G.release('left');
    if (e.key === 'ArrowRight') G.release('right');
    if (e.key === 'ArrowDown') G.setSoft(false);
  });

  // Gestos en el tablero: arrastrar para mover y bajar, tocar para girar,
  // deslizar rápido hacia abajo para soltar y hacia arriba para guardar.
  let gs = null;
  $('stage').addEventListener('pointerdown', e => {
    if (paused && playing && !modalOpen) { setPause(false); return; }
    if (!act() || !geo) return;
    gs = { id: e.pointerId, x0: e.clientX, y0: e.clientY, lx: e.clientX, ly: e.clientY, t0: performance.now(), axis: null, moved: false, trail: [[e.clientX, e.clientY, performance.now()]] };
  });
  window.addEventListener('pointermove', e => {
    if (!gs || e.pointerId !== gs.id || !act()) return;
    const now = performance.now(), cs = geo.cs;
    gs.trail.push([e.clientX, e.clientY, now]);
    while (gs.trail.length > 2 && now - gs.trail[0][2] > 120) gs.trail.shift();
    const dx = e.clientX - gs.x0, dy = e.clientY - gs.y0;
    if (!gs.axis && Math.hypot(dx, dy) > 12) gs.axis = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
    if (gs.axis === 'h') {
      const step = cs * 0.9;
      while (e.clientX - gs.lx >= step) { G.move(1); gs.lx += step; gs.moved = true; }
      while (gs.lx - e.clientX >= step) { G.move(-1); gs.lx -= step; gs.moved = true; }
    } else if (gs.axis === 'v') {
      const step = cs * 0.9;
      while (e.clientY - gs.ly >= step) { if (!G.softStep()) { gs.ly = e.clientY; break; } gs.ly += step; gs.moved = true; }
    }
  });
  function endGesture(e) {
    if (!gs || e.pointerId !== gs.id) return;
    const g = gs; gs = null;
    if (!act() || !geo) return;
    const now = performance.now(), dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    const first = g.trail[0], vy = (e.clientY - first[1]) / Math.max(1, now - first[2]); // px/ms
    if (g.axis === 'v' && vy > 0.9 && dy > geo.cs * 1.2) { G.hardDrop(); return; }
    if (g.axis === 'v' && vy < -0.7 && dy < -geo.cs * 1.5) { G.holdPiece(); return; }
    if (!g.axis && Math.hypot(dx, dy) < 12 && now - g.t0 < 350) {
      // tocar a la izquierda del tablero gira hacia la izquierda; en el resto, a la derecha
      const r = $('stage').getBoundingClientRect();
      G.rotate(e.clientX - r.left < geo.bx + geo.bw * 0.3 ? -1 : 1);
    }
  }
  window.addEventListener('pointerup', endGesture);
  window.addEventListener('pointercancel', e => { if (gs && e.pointerId === gs.id) gs = null; });

  // botones en pantalla
  document.querySelectorAll('.ctl button').forEach(b => {
    const c = b.dataset.c;
    b.addEventListener('pointerdown', e => {
      e.preventDefault();
      b.classList.add('on');
      if (paused && playing && !modalOpen) { setPause(false); return; }
      if (!act()) return;
      try { b.setPointerCapture(e.pointerId); } catch (err) { /* sin captura */ }
      if (c === 'left' || c === 'right') G.press(c);
      else if (c === 'soft') G.setSoft(true);
      else doCmd(c);
    });
    const up = () => {
      b.classList.remove('on');
      if (!G) return;
      if (c === 'left' || c === 'right') G.release(c);
      else if (c === 'soft') G.setSoft(false);
    };
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('lostpointercapture', up);
  });

  function setPause(v) {
    if (!playing) v = false;
    if (v === paused) return;
    paused = v;
    if (G) { G.setSoft(false); G.release('left'); G.release('right'); }
    if (paused) { MU.stop(); saveGame(); }
    else if (G && G.phase === 'play' && cfg.music && cfg.sound && ac()) MU.start(audio, TUNE_OF[G.mode]);
    last = performance.now();
  }

  // ---------- Ventanas ----------
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function sheet(html) {
    $('sheet').innerHTML = html;
    $('modal').classList.add('show');
    $('sheet').scrollTop = 0;
    modalOpen = true;
    if (G) { G.setSoft(false); G.release('left'); G.release('right'); }
    document.querySelectorAll('#sheet canvas[data-tema]').forEach(drawTemaPreview);
  }
  function closeSheet() { $('modal').classList.remove('show'); modalOpen = false; last = performance.now(); }
  $('modal').addEventListener('click', e => {
    const b = e.target.closest('[data-a]');
    if (b) action(b.dataset.a, b);
  });

  function drawTemaPreview(c) {
    const TM = temaOf(c.dataset.tema), dpr = window.devicePixelRatio || 1, w = 140, h = 84, cs = 14;
    c.width = w * dpr; c.height = h * dpr; c.style.width = w + 'px'; c.style.height = h + 'px';
    const x = c.getContext('2d'); x.scale(dpr, dpr);
    x.fillStyle = TM.colores.tablero; x.fillRect(0, 0, w, h);
    D.piece(x, TM, 'L', [[0, 2], [1, 2], [2, 2], [2, 1]], cs, 7, 21);
    D.piece(x, TM, 'T', [[3, 2], [4, 2], [5, 2], [4, 1]], cs, 7, 21);
    D.piece(x, TM, 'S', [[6, 2], [7, 2], [7, 1], [8, 1]], cs, 7, 21);
    D.piece(x, TM, 'I', [[2, 0], [3, 0], [4, 0], [5, 0]], cs, 7, 21);
  }

  function startSheet() {
    playing = false; MU.stop();
    const sv = savedGame();
    const M = MODES[cfg.mode];
    sheet(`<div class="logo">Encaja</div>
      <p class="tag">Encaja las piezas que caen y completa líneas</p>
      ${sv ? `<div class="continue"><div><b>Partida a medias</b><br><span>${esc(MODES[sv.g.mode].name)} · ${sv.g.score} puntos · ${sv.g.lines} líneas</span></div>
        <button class="btn primary" data-a="continue">Continuar</button></div>` : ''}
      <h3>Modo</h3>
      <div class="picks modes">${Object.entries(MODES).map(([k, m]) => `<button class="pick ${cfg.mode === k ? 'cur' : ''}" data-a="mode" data-v="${k}"><b>${m.name}</b><small>${m.desc}</small></button>`).join('')}</div>
      <div id="lvWrap" style="${M.startLevel ? '' : 'display:none'}"><h3>Nivel inicial</h3>
      <div class="seg">${[1, 3, 5, 8, 10, 12, 15].map(v => `<button data-a="level" data-v="${v}" class="${cfg.startLevel === v ? 'on' : ''}">${v}</button>`).join('')}</div></div>
      <h3>Tema</h3>
      <div class="picks">${TEMAS.map(TM => `<button class="pick ${cfg.tema === TM.id ? 'cur' : ''}" data-a="tema" data-v="${TM.id}"><canvas data-tema="${TM.id}"></canvas><b>${esc(TM.nombre)}</b><small>${esc(TM.descripcion)}</small></button>`).join('')}</div>
      <div class="row-btns">
        <button class="btn" data-a="records">Récords</button>
        <button class="btn" data-a="settings">Ajustes</button>
        <button class="btn" data-a="howto">Cómo se juega</button>
        <button class="btn primary big" data-a="go">¡A jugar!</button>
      </div>`);
  }

  function menuSheet() {
    if (playing) setPause(true);
    sheet(`<h2>Menú</h2><div class="menu-list">
      ${playing ? '<button class="btn" data-a="resume">Seguir jugando</button>' : ''}
      ${playing ? '<button class="btn" data-a="restart">Empezar de nuevo</button>' : ''}
      <button class="btn" data-a="start">Nueva partida (modo y tema)</button>
      <button class="btn" data-a="records">Récords</button>
      <button class="btn" data-a="settings">Ajustes</button>
      <button class="btn" data-a="howto">Cómo se juega</button>
    </div><div class="row-btns"><button class="btn" data-a="resume">Cerrar</button></div>`);
  }

  function recordsSheet() {
    const tab = Object.entries(MODES).filter(([, m]) => !m.zen).map(([k, m]) => {
      const list = records[k] || [];
      const head = m.byTime ? '<th>#</th><th>Tiempo</th><th>Puntos</th><th>Fecha</th>' : '<th>#</th><th>Puntos</th><th>Líneas</th><th>Nivel</th><th>Fecha</th>';
      const date = r => r.date.split('-').reverse().join('/');
      const rows = list.length ? list.map((r, i) => m.byTime
        ? `<tr><td>${i + 1}</td><td>${fmtTime(r.time, true)}</td><td>${r.score}</td><td>${date(r)}</td></tr>`
        : `<tr><td>${i + 1}</td><td>${r.score}</td><td>${r.lines}</td><td>${m.levels ? r.level : '–'}</td><td>${date(r)}</td></tr>`).join('')
        : `<tr><td colspan="5" style="color:var(--muted)">Todavía no hay partidas</td></tr>`;
      return `<h3>${esc(m.name)}</h3><table class="st"><tr>${head}</tr>${rows}</table>`;
    }).join('');
    sheet(`<h2>Récords</h2>${tab}
      <div class="row-btns"><button class="btn" data-a="resetRec">Borrar récords</button><button class="btn primary" data-a="back">Volver</button></div>`);
  }

  function settingsSheet() {
    const sw = (k, label, hint) => `<label class="set"><span>${label}${hint ? `<small>${hint}</small>` : ''}</span>
      <input type="checkbox" class="switch" data-a="cfg" data-k="${k}" ${cfg[k] ? 'checked' : ''}></label>`;
    sheet(`<h2>Ajustes</h2>
      ${sw('sound', 'Sonido')}
      ${sw('music', 'Música', 'Tres melodías propias, según el modo')}
      ${sw('marks', 'Marcas de aterrizaje', 'Señalan en el fondo dónde caerá la pieza')}
      ${sw('pad', 'Botones en pantalla', 'Además de los gestos sobre el tablero')}
      ${sw('vibrate', 'Vibrar al completar líneas')}
      <div class="set"><span>Velocidad al mantener pulsado<small>Botones y teclado: cuánto tarda en repetir el movimiento lateral</small></span>
        <div class="seg">${Object.entries(SPEEDS).map(([k, v]) => `<button data-a="speed" data-v="${k}" class="${cfg.speed === k ? 'on' : ''}">${v.name}</button>`).join('')}</div></div>
      <div class="row-btns"><button class="btn primary" data-a="back">Hecho</button></div>`);
  }

  function howtoSheet() {
    sheet(`<h2>Cómo se juega</h2>
      <ul>
        <li>Van cayendo piezas de cuatro cuadros. Muévelas y gíralas para que encajen y <b>completa filas</b>: las filas llenas desaparecen.</li>
        <li>Si las piezas llegan arriba del todo, se acaba la partida (salvo en Zen).</li>
        <li><b>Arrastra el dedo</b> a izquierda o derecha para mover la pieza, y hacia abajo para bajarla.</li>
        <li><b>Toca</b> el tablero para girarla a la derecha (en la parte izquierda, gira a la izquierda).</li>
        <li><b>Desliza rápido hacia abajo</b> para soltarla de golpe y <b>hacia arriba</b> para guardarla y sacar la siguiente (una vez por pieza).</li>
        <li>Las <b>marcas</b> del fondo indican dónde caerá. A la derecha ves las 5 siguientes.</li>
        <li>Puntos: 1 fila 100, 2 filas 300, 3 filas 500 y 4 filas (un <b>encaje</b>) 800, por el nivel.
          Encajar la pieza Te girándola en un hueco da más puntos (<b>giro</b>). Encadenar encajes o giros da un 50 % más (<b>racha</b>)
          y completar filas en piezas seguidas suma un <b>combo</b>. Dejar el tablero vacío tiene premio.</li>
        <li>Cada 10 líneas subes de nivel y las piezas caen más rápido.</li>
      </ul>
      <p>Con teclado: <kbd>←</kbd> <kbd>→</kbd> mover, <kbd>↓</kbd> bajar, <kbd>↑</kbd> o <kbd>X</kbd> girar a la derecha, <kbd>Z</kbd> a la izquierda,
        <kbd>A</kbd> media vuelta, <kbd>Espacio</kbd> soltar, <kbd>C</kbd> guardar, <kbd>P</kbd> pausa.</p>
      <div class="row-btns"><button class="btn primary" data-a="back">Entendido</button></div>`);
  }

  let returnTo = 'start';
  function action(a, el) {
    switch (a) {
      case 'mode':
        cfg.mode = el.dataset.v; save('en.cfg', cfg);
        document.querySelectorAll('#sheet [data-a="mode"]').forEach(b => b.classList.toggle('cur', b === el));
        $('lvWrap').style.display = MODES[cfg.mode].startLevel ? '' : 'none';
        newGame(false); hud();
        break;
      case 'tema':
        cfg.tema = el.dataset.v; save('en.cfg', cfg);
        document.querySelectorAll('#sheet [data-a="tema"]').forEach(b => b.classList.toggle('cur', b === el));
        T = temaOf(cfg.tema); layout(); boardKey = '';
        break;
      case 'level': case 'speed': {
        const k = a === 'level' ? 'startLevel' : 'speed';
        cfg[k] = a === 'level' ? +el.dataset.v : el.dataset.v; save('en.cfg', cfg);
        el.parentNode.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === el));
        if (a === 'speed' && G) { G.das = SPEEDS[cfg.speed].das; G.arr = SPEEDS[cfg.speed].arr; }
        if (a === 'level' && !playing) newGame(false);
        break;
      }
      case 'go': case 'again': ac(); closeSheet(); newGame(true); layout(); break;
      case 'restart': closeSheet(); newGame(true); layout(); break;
      case 'continue': ac(); closeSheet(); resumeSaved(); break;
      case 'start': returnTo = 'start'; startSheet(); break;
      case 'resume': closeSheet(); if (playing) setPause(false); break;
      case 'records': returnTo = modalReturn(); recordsSheet(); break;
      case 'settings': returnTo = modalReturn(); settingsSheet(); break;
      case 'howto': returnTo = modalReturn(); howtoSheet(); save('en.seenHelp', 1); break;
      case 'back': if (returnTo === 'start') startSheet(); else menuSheet(); break;
      case 'resetRec':
        if (confirm('¿Borrar todos los récords?')) { for (const k of Object.keys(records)) delete records[k]; save('en.records', records); recordsSheet(); }
        break;
      case 'cfg':
        cfg[el.dataset.k] = el.checked; save('en.cfg', cfg); applyCfg();
        if ((el.dataset.k === 'music' || el.dataset.k === 'sound') && !(cfg.music && cfg.sound)) MU.stop();
        break;
    }
  }
  const modalReturn = () => (playing ? 'menu' : 'start');

  function applyCfg() {
    document.body.classList.toggle('nopad', !cfg.pad);
    requestAnimationFrame(() => { layout(); });
  }

  // ---------- Sonido (sintetizado) ----------
  let audio = null;
  function ac() {
    try { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); if (audio.state === 'suspended') audio.resume(); } catch (e) { audio = null; }
    return audio;
  }
  function beep(freq, dur, delay, type, vol) {
    if (!cfg.sound || !ac()) return;
    const t = audio.currentTime + (delay || 0);
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = type || 'triangle'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.1, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
    o.connect(g).connect(audio.destination);
    o.start(t); o.stop(t + dur + 0.1);
  }
  function beepSeq(notes, gap) { notes.forEach(([f, d], k) => beep(f, d, k * gap)); }
  function sweep(f1, f2, dur, vol) {
    if (!cfg.sound || !ac()) return;
    const t = audio.currentTime, o = audio.createOscillator(), g = audio.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(vol || 0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(audio.destination); o.start(t); o.stop(t + dur + 0.05);
  }
  let noiseBuf = null;
  function noiseHit(dur, vol) {
    if (!cfg.sound || !ac()) return;
    if (!noiseBuf) { noiseBuf = audio.createBuffer(1, audio.sampleRate * 0.3, audio.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const t = audio.currentTime, s = audio.createBufferSource(), f = audio.createBiquadFilter(), g = audio.createGain();
    s.buffer = noiseBuf; f.type = 'lowpass'; f.frequency.value = 900;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(audio.destination); s.start(t); s.stop(t + dur + 0.02);
  }
  function vibrate(p) { if (cfg.vibrate && navigator.vibrate) try { navigator.vibrate(p); } catch (e) { /* sin vibración */ } }

  let toastTimer = 0;
  function toast(t) {
    const el = $('toast');
    el.textContent = t; el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  // ---------- Eventos generales ----------
  $('bMenu').onclick = () => (playing ? menuSheet() : startSheet());
  $('bPause').onclick = () => { if (playing) setPause(!paused); };
  window.addEventListener('resize', layout);
  document.addEventListener('visibilitychange', () => { if (document.hidden && playing) setPause(true); });

  // Llamadas desde la app Android
  window.appBack = function () {
    if (modalOpen && playing) { action('resume'); return true; }
    if (modalOpen && $('sheet').querySelector('.logo')) return false;
    if (modalOpen) { action('back'); return true; }
    if (playing && !paused) { menuSheet(); return true; }
    if (playing && paused) { setPause(false); return true; }
    startSheet(); return true;
  };
  window.appPause = function () { if (playing) setPause(true); };

  // ---------- Arranque ----------
  applyCfg();
  newGame(false);
  layout();
  startSheet();
  if (!load('en.seenHelp', 0)) { save('en.seenHelp', 1); returnTo = 'start'; setTimeout(howtoSheet, 300); }
  requestAnimationFrame(frame);

  window.ENDebug = { get G() { return G; }, newGame, action, doCmd, setPause, get paused() { return paused; }, get playing() { return playing; } };
})();
