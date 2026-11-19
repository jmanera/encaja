// Pruebas del motor: piezas, giros, puntuación, guardado y partidas jugadas por un bot.
// Uso: node tools/test.js
'use strict';
const path = require('path');
const assert = require('assert');
const M = require(path.join(__dirname, '../app/assets/motor.js'));
const { Game, COLS, ROWS, SHAPES, TYPES } = M;

let n = 0;
function test(name, fn) {
  try { fn(); n++; } catch (e) { console.error('FALLA:', name); throw e; }
}

function started(opts) {
  const g = new Game(Object.assign({ seed: 7 }, opts));
  g.update(2); // pasa la fase de "preparados" y saca la primera pieza
  assert.strictEqual(g.phase, 'play');
  return g;
}
// rellena filas dejando huecos en las columnas indicadas
function fill(g, y, holes) {
  for (let x = 0; x < COLS; x++) if (!holes.includes(x)) { g.cells[y][x] = 8; g.ids[y][x] = 999; }
}
function put(g, t, r, x, y) {
  g.s.cur = { t, r, x, y, id: 500, low: y, resets: 0, lockT: 0, fallT: 0, lastRot: false, kick: -1 };
}

test('formas', () => {
  for (const t of TYPES) {
    const { n: size, states } = SHAPES[t];
    assert.strictEqual(states.length, 4);
    for (const st of states) {
      assert.strictEqual(st.length, 4);
      assert.strictEqual(new Set(st.map(c => c.join())).size, 4);
      for (const [x, y] of st) assert(x >= 0 && y >= 0 && x < size && y < size);
    }
  }
  // cuatro giros a la derecha vuelven al principio
  assert.deepStrictEqual(SHAPES.T.states[0], [[1, 0], [0, 1], [1, 1], [2, 1]]);
});

test('bolsa de 7', () => {
  const g = new Game({ seed: 123 });
  const seen = [];
  for (let k = 0; k < 700; k++) { seen.push(g.queue.shift()); g.fillQueue(); }
  for (let b = 0; b < 100; b++) assert.strictEqual(new Set(seen.slice(b * 7, b * 7 + 7)).size, 7, 'cada bolsa trae las 7');
  // misma semilla, mismas piezas
  const a = new Game({ seed: 99 }), c = new Game({ seed: 99 });
  assert.deepStrictEqual(a.queue, c.queue);
});

test('aparece arriba y cae', () => {
  const g = started({});
  const p = g.cur;
  assert.strictEqual(p.x, 3);
  const y0 = p.y;
  g.update(1.5);
  assert(g.cur.y > y0 || g.cur.id !== p.id, 'la gravedad la baja');
});

test('mover y paredes', () => {
  const g = started({});
  let k = 0;
  while (g.move(-1)) k++;
  assert(k >= 3 && k <= 4);
  assert(!g.move(-1));
  for (const [x] of g.blocks(g.cur)) assert(x >= 0);
});

test('giro con desplazamiento en la pared', () => {
  const g = started({});
  put(g, 'I', 1, -2, 5); // vertical pegado a la izquierda (celdas en x = 0)
  assert(g.fits(g.cur));
  assert(g.rotate(1), 'el palo gira aunque esté contra la pared');
  for (const [x] of g.blocks(g.cur)) assert(x >= 0 && x < COLS);
});

test('caída directa y fijar', () => {
  const g = started({});
  const t = g.cur.t, sc = g.score;
  g.hardDrop();
  assert(g.score > sc, 'puntos por caída directa');
  const bottom = g.cells[ROWS - 1].filter(Boolean).length + g.cells[ROWS - 2].filter(Boolean).length;
  assert.strictEqual(bottom, 4, `la pieza ${t} queda en el fondo`);
  assert(g.cur && g.cur.t, 'sale la siguiente');
});

test('tiempo para fijar', () => {
  const g = started({});
  g.cur.y = g.dropY();
  const id = g.cur.id;
  g.update(0.3);
  assert.strictEqual(g.cur.id, id, 'todavía se puede mover');
  g.move(1); // reinicia el tiempo
  g.update(0.3);
  assert.strictEqual(g.cur.id, id);
  g.update(0.3);
  assert.notStrictEqual(g.cur.id, id, 'se fija pasado medio segundo quieta');
});

test('límite de reinicios', () => {
  const g = started({});
  put(g, 'T', 0, 3, 0); g.cur.y = g.dropY(); g.cur.low = g.cur.y;
  const id = g.cur.id;
  for (let k = 0; k < 30 && g.cur && g.cur.id === id; k++) { g.update(0.1); g.move(k % 2 ? 1 : -1); }
  assert(!g.cur || g.cur.id !== id, 'no se puede retrasar para siempre');
});

test('guardar pieza', () => {
  const g = started({});
  const t = g.cur.t, next = g.queue[0];
  assert(g.holdPiece());
  assert.strictEqual(g.hold, t);
  assert.strictEqual(g.cur.t, next);
  assert(!g.holdPiece(), 'solo una vez por pieza');
  g.hardDrop();
  assert(g.holdPiece(), 'después de fijar, otra vez');
  assert.strictEqual(g.cur.t, t);
});

test('una línea y tablero limpio', () => {
  const g = started({});
  fill(g, ROWS - 1, [0, 1, 2, 3]);
  put(g, 'I', 0, 0, 3);
  g.takeEvents();
  g.hardDrop();
  const c = g.takeEvents().find(e => e.type === 'clear');
  assert(c && c.lines === 1 && c.clean, 'línea y tablero vacío');
  assert.strictEqual(g.lines, 1);
  assert(g.cells.every(r => r.every(v => !v)));
  assert.strictEqual(c.points, 100 + 800);
});

test('cuatro líneas y racha', () => {
  const g = started({});
  for (let y = ROWS - 8; y < ROWS; y++) fill(g, y, [9]);
  put(g, 'I', 1, 7, 3);
  g.hardDrop();
  let c = g.takeEvents().find(e => e.type === 'clear');
  assert.strictEqual(c.lines, 4); assert.strictEqual(c.points, 800); assert(!c.b2b);
  put(g, 'I', 1, 7, 3);
  g.hardDrop();
  c = g.takeEvents().find(e => e.type === 'clear');
  assert.strictEqual(c.lines, 4);
  assert(c.b2b, 'segunda seguida: racha');
  assert(c.clean, 'el tablero queda vacío');
  assert.strictEqual(c.points, 1200 + 50 + 2000); // x1,5, combo 1 y tablero limpio
});

test('giro especial doble', () => {
  // hueco en forma de Te con un saliente encima
  const g = started({});
  fill(g, ROWS - 1, [4]);
  fill(g, ROWS - 2, [3, 4, 5]);
  g.cells[ROWS - 3][3] = 8;
  // buscar una posición desde la que un giro deje la Te dentro del hueco
  let found = false;
  for (let r = 0; r < 4 && !found; r++) for (let x = -1; x < COLS && !found; x++) for (let y = 0; y < ROWS && !found; y++) for (const d of [1, -1]) {
    put(g, 'T', r, x, y);
    if (!g.fits(g.cur)) continue;
    if (g.rotate(d) && g.cur.r === 2 && g.cur.x === 3 && g.cur.y === ROWS - 3) { found = true; break; }
  }
  assert(found, 'se puede entrar girando');
  assert.strictEqual(g.spinKind(g.cur), 'full');
  g.lock();
  const c = g.takeEvents().find(e => e.type === 'clear');
  assert.strictEqual(c.spin, 'full'); assert.strictEqual(c.lines, 2); assert.strictEqual(c.points, 1200);
});

test('sin giro no cuenta', () => {
  const g = started({});
  fill(g, ROWS - 1, [4]);
  fill(g, ROWS - 2, [3, 4, 5]);
  g.cells[ROWS - 3][0] = 8; // para que no quede el tablero vacío
  put(g, 'T', 2, 3, 2);
  g.hardDrop();
  const c = g.takeEvents().find(e => e.type === 'clear');
  assert.strictEqual(c.spin, null); assert.strictEqual(c.lines, 2); assert.strictEqual(c.points, 300);
});

test('combo', () => {
  const g = started({});
  let combo = [];
  for (let k = 0; k < 3; k++) {
    for (let y = ROWS - 3; y < ROWS; y++) fill(g, y, []);
    fill(g, ROWS - 1, [0, 1, 2, 3]);
    put(g, 'I', 0, 0, 3);
    g.hardDrop();
    combo.push(g.takeEvents().find(e => e.type === 'clear').combo);
    for (let y = 0; y < ROWS; y++) { g.cells[y].fill(0); g.ids[y].fill(0); }
  }
  assert.deepStrictEqual(combo, [0, 1, 2]);
});

test('nivel sube cada 10 líneas', () => {
  const g = started({ mode: 'maraton', startLevel: 3 });
  assert.strictEqual(g.level, 3);
  g.s.lines = 9;
  fill(g, ROWS - 1, [0, 1, 2, 3]); fill(g, ROWS - 2, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  put(g, 'I', 0, 0, 3); g.hardDrop();
  assert.strictEqual(g.level, 4);
  assert(M.gravity(1) > M.gravity(5) && M.gravity(5) > M.gravity(15));
});

test('fin por no caber', () => {
  const g = started({ mode: 'infinito' });
  for (let y = 2; y < ROWS; y++) fill(g, y, [y % COLS]);
  g.hardDrop();
  assert.strictEqual(g.phase, 'over');
});

test('zen no se pierde', () => {
  const g = started({ mode: 'zen' });
  for (let y = 2; y < ROWS; y++) fill(g, y, [y % COLS]);
  g.hardDrop();
  assert.strictEqual(g.phase, 'play');
  assert(g.cur);
});

test('contrarreloj termina', () => {
  const g = started({ mode: 'ultra' });
  for (let k = 0; k < 130; k++) g.update(1);
  assert.strictEqual(g.phase, 'over');
  assert.strictEqual(g.s.result, 'time');
  assert.strictEqual(g.left, 0);
});

test('autorrepetición', () => {
  const g = started({});
  g.press('right');
  const x1 = g.cur.x;
  g.update(0.1); assert.strictEqual(g.cur.x, x1, 'espera antes de repetir');
  for (let k = 0; k < 20; k++) g.update(0.03);
  const right = Math.max(...g.blocks(g.cur).map(b => b[0]));
  assert.strictEqual(right, COLS - 1, 'llega a la pared');
  g.release('right');
});

test('guardar y seguir la partida', () => {
  const g = started({ seed: 42 });
  g.hardDrop(); g.move(1); g.rotate(1);
  const json = JSON.parse(JSON.stringify(g.toJSON()));
  const h = Game.from(json);
  for (let k = 0; k < 20; k++) { g.hardDrop(); h.hardDrop(); g.update(0.02); h.update(0.02); }
  assert.deepStrictEqual(h.cells, g.cells);
  assert.strictEqual(h.score, g.score);
  assert.deepStrictEqual(h.queue, g.queue);
});

test('reto del día', () => {
  assert.strictEqual(M.dailySeed(new Date('2026-11-19T10:00:00Z')), M.dailySeed(new Date('2026-11-19T20:00:00Z')));
  assert.notStrictEqual(M.dailySeed(new Date('2026-11-19T10:00:00Z')), M.dailySeed(new Date('2026-11-20T10:00:00Z')));
});

// ---------- Bot: coloca piezas con una evaluación sencilla ----------
function evaluate(cells) {
  const heights = [];
  let holes = 0;
  for (let x = 0; x < COLS; x++) {
    let h = 0, seen = false;
    for (let y = 0; y < ROWS; y++) {
      if (cells[y][x]) { if (!seen) { h = ROWS - y; seen = true; } } else if (seen) holes++;
    }
    heights.push(h);
  }
  let bump = 0;
  for (let x = 1; x < COLS; x++) bump += Math.abs(heights[x] - heights[x - 1]);
  return -0.51 * heights.reduce((a, b) => a + b, 0) - 0.36 * holes - 0.18 * bump;
}
function botMove(g) {
  const p = g.cur;
  let best = null;
  for (let r = 0; r < 4; r++) for (let x = -2; x < COLS; x++) {
    const q = Object.assign({}, p, { r, x });
    if (!g.fits(q, r, x, p.y)) continue;
    const y = g.dropY(q);
    const cells = g.cells.map(row => row.slice());
    for (const [bx, by] of g.blocks(q, r, x, y)) if (by >= 0) cells[by][bx] = 1;
    const kept = cells.filter(row => !row.every(Boolean));
    const lines = ROWS - kept.length;
    while (kept.length < ROWS) kept.unshift(new Array(COLS).fill(0));
    const v = evaluate(kept) + 0.76 * lines;
    if (!best || v > best.v) best = { v, r, x };
  }
  if (best) {
    const turns = best.r;
    for (let k = 0; k < turns; k++) g.rotate(1);
    let guard = 20;
    while (g.cur && g.cur.x !== best.x && guard--) if (!g.move(g.cur.x < best.x ? 1 : -1)) break;
  }
  g.hardDrop();
}
function botGame(opts, maxPieces) {
  const g = started(opts);
  let pieces = 0, events = 0;
  while (g.phase === 'play' && pieces < maxPieces) {
    botMove(g); pieces++;
    events += g.takeEvents().length;
    g.update(1 / 60);
  }
  return { g, pieces };
}

test('bot en maratón', () => {
  let total = 0;
  for (const seed of [1, 2, 3]) {
    const { g, pieces } = botGame({ mode: 'infinito', seed }, 600);
    total += g.lines;
    assert(pieces >= 600 || g.lines > 60, `semilla ${seed}: ${g.lines} líneas en ${pieces} piezas`);
  }
  assert(total > 400, `líneas totales ${total}`);
});

test('bot completa sprint', () => {
  const { g } = botGame({ mode: 'sprint', seed: 5 }, 400);
  assert.strictEqual(g.phase, 'over');
  assert.strictEqual(g.s.result, 'win');
  assert(g.lines >= 40);
});

test('bot completa maratón', () => {
  const { g } = botGame({ mode: 'maraton', seed: 11 }, 800);
  assert.strictEqual(g.s.result, 'win', `resultado ${g.s.result} con ${g.lines} líneas`);
  assert.strictEqual(g.level, 16);
});

console.log(`OK: ${n} pruebas`);
