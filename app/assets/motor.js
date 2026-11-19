// Encaja: lógica del juego, sin DOM (se prueba con Node).
// Tablero de 10 columnas x 22 filas visibles, con 2 filas ocultas encima donde aparecen las piezas.
// Coordenadas: x de izquierda a derecha, y de arriba abajo (y = 0 es la fila oculta más alta).
(function (root) {
  'use strict';

  const COLS = 10, VISIBLE = 22, HIDDEN = 2, ROWS = VISIBLE + HIDDEN;
  const TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
  // Nombres propios de las piezas
  const NAMES = { I: 'Palo', O: 'Cubo', T: 'Te', S: 'Ese', Z: 'Zeta', J: 'Jota', L: 'Ele' };

  // Forma inicial de cada pieza dentro de su caja (n x n); los giros se calculan.
  const BASE = {
    I: { n: 4, c: [[0, 1], [1, 1], [2, 1], [3, 1]] },
    O: { n: 4, c: [[1, 0], [2, 0], [1, 1], [2, 1]] },
    T: { n: 3, c: [[1, 0], [0, 1], [1, 1], [2, 1]] },
    S: { n: 3, c: [[1, 0], [2, 0], [0, 1], [1, 1]] },
    Z: { n: 3, c: [[0, 0], [1, 0], [1, 1], [2, 1]] },
    J: { n: 3, c: [[0, 0], [0, 1], [1, 1], [2, 1]] },
    L: { n: 3, c: [[2, 0], [0, 1], [1, 1], [2, 1]] },
  };
  const SHAPES = {};
  for (const t of TYPES) {
    const { n, c } = BASE[t], st = [c];
    for (let r = 1; r < 4; r++) st.push(t === 'O' ? c : st[r - 1].map(([x, y]) => [n - 1 - y, x]));
    SHAPES[t] = { n, states: st };
  }

  // Desplazamientos que se prueban al girar si la pieza choca (y hacia arriba es negativo).
  // Clave: estado de origen + estado de destino (0 inicial, 1 derecha, 2 al revés, 3 izquierda).
  const up = list => list.map(([x, y]) => [x, -y]);
  const KICKS = {
    '01': up([[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]]),
    '10': up([[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]]),
    '12': up([[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]]),
    '21': up([[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]]),
    '23': up([[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]]),
    '32': up([[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]]),
    '30': up([[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]]),
    '03': up([[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]]),
  };
  const KICKS_I = {
    '01': up([[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]]),
    '10': up([[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]]),
    '12': up([[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]]),
    '21': up([[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]]),
    '23': up([[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]]),
    '32': up([[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]]),
    '30': up([[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]]),
    '03': up([[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]]),
  };
  // Giro de media vuelta: sin tabla oficial, probamos unos pocos desplazamientos sencillos.
  const KICKS_180 = [[0, 0], [0, -1], [1, 0], [-1, 0], [0, 1]];

  // Modos de juego
  const MODES = {
    maraton: { name: 'Maratón', desc: '150 líneas, la velocidad sube cada 10', lines: 150, levels: true, startLevel: true },
    infinito: { name: 'Sin fin', desc: 'Hasta que no quepa nada más', levels: true, startLevel: true },
    sprint: { name: 'Sprint', desc: '40 líneas lo más rápido posible', lines: 40, byTime: true },
    ultra: { name: 'Contrarreloj', desc: 'Máxima puntuación en 2 minutos', time: 120, levels: true },
    diario: { name: 'Reto del día', desc: '3 minutos, las mismas piezas para todos hoy', time: 180, levels: true, daily: true },
    zen: { name: 'Zen', desc: 'Sin prisa y sin perder nunca', zen: true },
  };

  // Puntos por líneas (se multiplican por el nivel)
  const LINE_PTS = [0, 100, 300, 500, 800];
  const SPIN_PTS = [400, 800, 1200, 1600];
  const MINI_PTS = [100, 200, 400];
  const CLEAN_PTS = [0, 800, 1200, 1800, 2000];

  // Segundos que tarda en bajar una fila según el nivel
  const gravity = level => Math.pow(0.8 - (Math.min(level, 20) - 1) * 0.007, Math.min(level, 20) - 1);

  // Generador de números aleatorios con semilla (mulberry32); el estado cabe en un número.
  function nextRand(s) {
    s.r = (s.r + 0x6D2B79F5) | 0;
    let t = s.r;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  const LOCK_DELAY = 0.5, MAX_RESETS = 15, QUEUE = 5;

  class Game {
    // opts: { mode, startLevel, seed, das, arr }
    constructor(opts) {
      opts = opts || {};
      const mode = MODES[opts.mode] ? opts.mode : 'maraton';
      const M = MODES[mode];
      const seed = opts.seed != null ? opts.seed : Math.floor(Math.random() * 2 ** 31);
      this.s = {
        mode, seed, r: seed | 0,
        startLevel: M.startLevel ? Math.max(1, Math.min(15, opts.startLevel || 1)) : 1,
        cells: Array.from({ length: ROWS }, () => new Array(COLS).fill(0)), // tipo 1..7 (0 vacía)
        ids: Array.from({ length: ROWS }, () => new Array(COLS).fill(0)),   // pieza a la que pertenece
        nextId: 1,
        bag: [], queue: [], hold: null, holdUsed: false,
        cur: null, // {t, r, x, y, id, low, resets, lockT, fallT, lastRot, kick}
        score: 0, lines: 0, level: 1, time: 0, pieces: 0,
        combo: -1, b2b: false, counts: { single: 0, double: 0, triple: 0, quad: 0, spins: 0, clean: 0 },
        maxCombo: 0, phase: 'ready', phaseT: 1.2, result: null,
        soft: false, dirs: { left: false, right: false }, das: { dir: 0, t: 0, a: 0 },
      };
      this.s.level = this.s.startLevel;
      this.das = opts.das != null ? opts.das : 0.167;
      this.arr = opts.arr != null ? opts.arr : 0.033;
      this.events = [];
      this.fillQueue();
    }

    static from(json, opts) {
      const g = new Game(Object.assign({ mode: json.mode, seed: json.seed }, opts));
      g.s = JSON.parse(JSON.stringify(json));
      g.s.soft = false; g.s.dirs = { left: false, right: false }; g.s.das = { dir: 0, t: 0, a: 0 };
      return g;
    }
    toJSON() { return this.s; }

    get mode() { return this.s.mode; }
    get M() { return MODES[this.s.mode]; }
    get phase() { return this.s.phase; }
    get cur() { return this.s.cur; }
    get score() { return this.s.score; }
    get lines() { return this.s.lines; }
    get level() { return this.s.level; }
    get time() { return this.s.time; }
    get hold() { return this.s.hold; }
    get queue() { return this.s.queue; }
    get cells() { return this.s.cells; }
    get ids() { return this.s.ids; }
    // tiempo que queda en los modos con reloj
    get left() { return this.M.time ? Math.max(0, this.M.time - this.s.time) : null; }

    // ---------- Piezas ----------
    fillQueue() {
      const s = this.s;
      while (s.queue.length < QUEUE + 1) {
        if (!s.bag.length) {
          // bolsa con las 7 piezas en orden aleatorio
          const b = TYPES.slice();
          for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(nextRand(s) * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
          s.bag = b;
        }
        s.queue.push(s.bag.shift());
      }
    }

    blocks(p, r, x, y) {
      r = r == null ? p.r : r; x = x == null ? p.x : x; y = y == null ? p.y : y;
      return SHAPES[p.t].states[r].map(([cx, cy]) => [x + cx, y + cy]);
    }
    fits(p, r, x, y) {
      for (const [bx, by] of this.blocks(p, r, x, y)) {
        if (bx < 0 || bx >= COLS || by >= ROWS) return false;
        if (by >= 0 && this.s.cells[by][bx]) return false;
      }
      return true;
    }
    // fila donde caería la pieza actual
    dropY(p) {
      p = p || this.s.cur;
      let y = p.y;
      while (this.fits(p, p.r, p.x, y + 1)) y++;
      return y;
    }

    spawn(t) {
      const s = this.s;
      if (!t) { t = s.queue.shift(); this.fillQueue(); }
      const p = { t, r: 0, x: 3, y: 0, id: s.nextId++, low: 0, resets: 0, lockT: 0, fallT: 0, lastRot: false, kick: -1 };
      if (!this.fits(p, 0, p.x, p.y)) {
        if (this.M.zen) { this.zenReset(); return this.spawn(t); }
        s.cur = p; return this.end('topout');
      }
      if (this.fits(p, 0, p.x, p.y + 1)) p.y++; // aparece una fila más abajo si cabe
      p.low = p.y;
      s.cur = p;
      this.events.push({ type: 'spawn', t });
      return true;
    }

    zenReset() {
      // en Zen no se pierde: el tablero se vacía y se sigue
      const s = this.s;
      for (let y = 0; y < ROWS; y++) { s.cells[y].fill(0); s.ids[y].fill(0); }
      this.events.push({ type: 'zenReset' });
    }

    // ---------- Acciones ----------
    canAct() { return this.s.phase === 'play' && this.s.cur; }

    move(dx) {
      if (!this.canAct()) return false;
      const p = this.s.cur;
      if (!this.fits(p, p.r, p.x + dx, p.y)) return false;
      p.x += dx; p.lastRot = false;
      this.afterShift();
      this.events.push({ type: 'move' });
      return true;
    }

    rotate(dir) { // 1 derecha, -1 izquierda, 2 media vuelta
      if (!this.canAct()) return false;
      const p = this.s.cur;
      if (p.t === 'O') return false;
      const to = (p.r + (dir === 2 ? 2 : dir) + 4) % 4;
      const tests = dir === 2 ? KICKS_180 : (p.t === 'I' ? KICKS_I : KICKS)[`${p.r}${to}`];
      for (let k = 0; k < tests.length; k++) {
        const [kx, ky] = tests[k];
        if (this.fits(p, to, p.x + kx, p.y + ky)) {
          p.x += kx; p.y += ky; p.r = to; p.lastRot = true; p.kick = dir === 2 ? -1 : k;
          this.afterShift();
          this.events.push({ type: 'rotate' });
          return true;
        }
      }
      return false;
    }

    // tras moverse o girar: si está apoyada, el tiempo para fijarla vuelve a empezar (con límite)
    afterShift() {
      const p = this.s.cur;
      if (p.y > p.low) { p.low = p.y; p.resets = 0; }
      if (!this.fits(p, p.r, p.x, p.y + 1)) {
        if (p.resets < MAX_RESETS) { p.lockT = 0; p.resets++; }
      }
    }

    // bajar una fila a mano (arrastrando el dedo hacia abajo)
    softStep() {
      if (!this.canAct()) return false;
      const p = this.s.cur;
      if (!this.fits(p, p.r, p.x, p.y + 1)) return false;
      p.y++; p.lastRot = false; p.fallT = 0;
      this.s.score += 1;
      if (p.y > p.low) { p.low = p.y; p.resets = 0; p.lockT = 0; }
      this.events.push({ type: 'step' });
      return true;
    }

    hardDrop() {
      if (!this.canAct()) return false;
      const p = this.s.cur, y = this.dropY(p), n = y - p.y;
      if (n > 0) p.lastRot = false;
      const from = p.y;
      p.y = y;
      this.s.score += 2 * n;
      this.events.push({ type: 'hardDrop', rows: n, from });
      this.lock();
      return true;
    }

    holdPiece() {
      const s = this.s;
      if (!this.canAct() || s.holdUsed) return false;
      const t = s.cur.t;
      const prev = s.hold;
      s.hold = t;
      this.events.push({ type: 'hold' });
      if (prev) this.spawn(prev); else this.spawn();
      s.holdUsed = true;
      return true;
    }

    setSoft(v) { this.s.soft = !!v; }
    // teclas mantenidas para moverse con autorrepetición
    press(dir) {
      const s = this.s;
      s.dirs[dir] = true;
      const d = dir === 'left' ? -1 : 1;
      s.das = { dir: d, t: 0, a: 0 };
      this.move(d);
    }
    release(dir) {
      const s = this.s;
      s.dirs[dir] = false;
      const other = dir === 'left' ? 'right' : 'left';
      if (s.dirs[other]) s.das = { dir: other === 'left' ? -1 : 1, t: 0, a: 0 };
      else s.das = { dir: 0, t: 0, a: 0 };
    }

    // ---------- Fijar la pieza y borrar líneas ----------
    lock() {
      const s = this.s, p = s.cur;
      const spin = this.spinKind(p);
      const bl = this.blocks(p);
      let above = true;
      for (const [x, y] of bl) {
        if (y >= 0) { s.cells[y][x] = TYPES.indexOf(p.t) + 1; s.ids[y][x] = p.id; }
        if (y >= HIDDEN) above = false;
      }
      s.cur = null; s.pieces++;
      this.events.push({ type: 'lock', t: p.t, blocks: bl, id: p.id });
      if (above && !this.M.zen) return this.end('lockout');

      // líneas completas
      const full = [];
      for (let y = 0; y < ROWS; y++) if (s.cells[y].every(v => v)) full.push(y);
      const rows = full.map(y => s.cells[y].slice());
      for (const y of full) {
        s.cells.splice(y, 1); s.ids.splice(y, 1);
        s.cells.unshift(new Array(COLS).fill(0)); s.ids.unshift(new Array(COLS).fill(0));
      }
      const n = full.length, L = s.level;
      let pts = 0, hard = false;
      if (spin === 'full') { pts = SPIN_PTS[n] * L; hard = n > 0; }
      else if (spin === 'mini') { pts = MINI_PTS[Math.min(n, 2)] * L; hard = n > 0; }
      else { pts = LINE_PTS[n] * L; hard = n === 4; }
      let b2b = false;
      if (n > 0) {
        if (hard && s.b2b) { pts = Math.floor(pts * 1.5); b2b = true; }
        s.b2b = hard;
        s.combo++;
        if (s.combo > 0) pts += 50 * s.combo * L;
        s.maxCombo = Math.max(s.maxCombo, s.combo);
      } else s.combo = -1;
      const clean = n > 0 && s.cells.every(r => r.every(v => !v));
      if (clean) { pts += CLEAN_PTS[n] * L; s.counts.clean++; }
      if (n) s.counts[['', 'single', 'double', 'triple', 'quad'][n]]++;
      if (spin && n) s.counts.spins++;
      s.score += pts;
      s.lines += n;
      if (n || spin) this.events.push({ type: 'clear', lines: n, rows: full, cells: rows, spin, b2b, combo: s.combo, clean, points: pts });
      if (this.M.levels) {
        const lv = s.startLevel + Math.floor(s.lines / 10);
        if (lv > s.level) { s.level = lv; this.events.push({ type: 'level', level: lv }); }
      }
      if (this.M.lines && s.lines >= this.M.lines) return this.end('win');
      s.holdUsed = false;
      this.spawn();
      return true;
    }

    // giro especial: la Te encajada girando, con al menos 3 esquinas ocupadas
    spinKind(p) {
      if (p.t !== 'T' || !p.lastRot) return null;
      const occ = (x, y) => x < 0 || x >= COLS || y >= ROWS || (y >= 0 && this.s.cells[y][x] !== 0);
      const c = [occ(p.x, p.y), occ(p.x + 2, p.y), occ(p.x + 2, p.y + 2), occ(p.x, p.y + 2)]; // ↖ ↗ ↘ ↙
      if (c.filter(Boolean).length < 3) return null;
      const front = [[0, 1], [1, 2], [2, 3], [3, 0]][p.r];
      if (c[front[0]] && c[front[1]]) return 'full';
      return p.kick === 4 ? 'full' : 'mini';
    }

    end(why) {
      const s = this.s;
      s.phase = 'over'; s.phaseT = 0;
      s.result = why;
      this.events.push({ type: why === 'win' || why === 'time' ? 'win' : 'over', why });
      return false;
    }

    // ---------- Tiempo ----------
    // eventos ocurridos desde la última vez (acciones y tiempo)
    takeEvents() { const e = this.events; this.events = []; return e; }

    update(dt) {
      const s = this.s;
      if (s.phase === 'ready') {
        s.phaseT -= dt;
        if (s.phaseT <= 0) { s.phase = 'play'; this.events.push({ type: 'go' }); this.spawn(); }
        return;
      }
      if (s.phase !== 'play') { s.phaseT += dt; return; }
      s.time += dt;
      if (this.M.time && s.time >= this.M.time) { s.time = this.M.time; this.end('time'); return; }
      const p = s.cur;
      if (!p) return;

      // autorrepetición al mantener izquierda o derecha
      const d = s.das;
      if (d.dir) {
        d.t += dt;
        if (d.t >= this.das) {
          if (this.arr <= 0) { while (this.move(d.dir)) { /* hasta la pared */ } }
          else {
            d.a += dt;
            while (d.a >= this.arr) { d.a -= this.arr; if (!this.move(d.dir)) { d.a = 0; break; } }
          }
        }
      }

      // caída
      const g = this.M.zen ? gravity(1) : gravity(s.level);
      const step = s.soft ? Math.min(g / 20, 0.033) : g;
      if (this.fits(p, p.r, p.x, p.y + 1)) {
        p.fallT += dt;
        while (p.fallT >= step && this.fits(p, p.r, p.x, p.y + 1)) {
          p.fallT -= step; p.y++; p.lastRot = false;
          if (s.soft) s.score += 1;
          if (p.y > p.low) { p.low = p.y; p.resets = 0; p.lockT = 0; }
        }
        if (!this.fits(p, p.r, p.x, p.y + 1)) p.fallT = 0;
      } else {
        p.fallT = 0;
        p.lockT += dt;
        if (p.lockT >= LOCK_DELAY) this.lock();
      }
    }
  }

  // semilla del reto diario: la misma para todos el mismo día
  function dailySeed(date) {
    const d = (date || new Date()).toISOString().slice(0, 10);
    let h = 2166136261;
    for (const ch of d) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  const api = { Game, MODES, TYPES, NAMES, SHAPES, COLS, ROWS, VISIBLE, HIDDEN, KICKS, KICKS_I, gravity, dailySeed };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ENMotor = api;
})(typeof window !== 'undefined' ? window : globalThis);
