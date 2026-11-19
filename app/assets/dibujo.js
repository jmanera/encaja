// Encaja: dibujo en canvas. Cada pieza se pinta como una sola forma continua (sin juntas entre
// cuadros), con el estilo del tema: caramelo, madera, neón o regalo.
(function () {
  'use strict';
  const { SHAPES, TYPES, COLS, VISIBLE, HIDDEN } = ENMotor;

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // color más claro (+) o más oscuro (-)
  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const f = c => Math.round(k >= 0 ? c + (255 - c) * k : c * (1 + k));
    r = f(r); g = f(g); b = f(b);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }
  const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

  // Añade al camino actual la silueta de un grupo de casillas (coordenadas en casillas).
  // m: margen hacia dentro, r: radio de las esquinas; todo en píxeles.
  function shapePath(ctx, cells, cs, ox, oy, m, r) {
    const has = new Set(cells.map(([x, y]) => x + ',' + y));
    const H = (x, y) => has.has(x + ',' + y);
    for (const [x, y] of cells) {
      const px = ox + x * cs, py = oy + y * cs;
      roundRect(ctx, px + m, py + m, cs - 2 * m, cs - 2 * m, r);
      // puentes con los vecinos de la misma pieza (tapan también las esquinas redondeadas)
      if (H(x + 1, y)) ctx.rect(px + cs - m - r, py + m, 2 * (m + r), cs - 2 * m);
      if (H(x, y + 1)) ctx.rect(px + m, py + cs - m - r, cs - 2 * m, 2 * (m + r));
      if (H(x + 1, y) && H(x, y + 1) && H(x + 1, y + 1)) ctx.rect(px + cs - m - r, py + cs - m - r, 2 * (m + r), 2 * (m + r));
    }
  }

  function bounds(cells) {
    let x0 = 99, y0 = 99, x1 = -99, y1 = -99;
    for (const [x, y] of cells) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    return { x0, y0, x1: x1 + 1, y1: y1 + 1 };
  }

  // ---------- Estilos de pieza ----------
  const STYLES = {
    caramelo(ctx, T, col, cells, cs, ox, oy) {
      const b = bounds(cells);
      ctx.beginPath(); shapePath(ctx, cells, cs, ox, oy + cs * 0.06, cs * 0.05, cs * 0.26);
      ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fill();
      ctx.beginPath(); shapePath(ctx, cells, cs, ox, oy, cs * 0.05, cs * 0.26);
      ctx.fillStyle = shade(col, -0.32); ctx.fill();
      ctx.beginPath(); shapePath(ctx, cells, cs, ox, oy, cs * 0.1, cs * 0.22);
      const g = ctx.createLinearGradient(0, oy + b.y0 * cs, 0, oy + b.y1 * cs);
      g.addColorStop(0, shade(col, 0.22)); g.addColorStop(1, col);
      ctx.fillStyle = g; ctx.fill();
      // brillo superior
      ctx.beginPath(); shapePath(ctx, cells, cs, ox - cs * 0.04, oy - cs * 0.07, cs * 0.26, cs * 0.16);
      ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fill();
      // reflejo en la primera casilla
      const [fx, fy] = cells.slice().sort((a, c) => a[1] - c[1] || a[0] - c[0])[0];
      ctx.beginPath(); ctx.ellipse(ox + (fx + 0.32) * cs, oy + (fy + 0.28) * cs, cs * 0.1, cs * 0.065, -0.6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fill();
    },

    madera(ctx, T, col, cells, cs, ox, oy) {
      const b = bounds(cells);
      ctx.beginPath(); shapePath(ctx, cells, cs, ox, oy, cs * 0.04, cs * 0.12);
      ctx.fillStyle = shade(col, -0.45); ctx.fill();
      ctx.save();
      ctx.beginPath(); shapePath(ctx, cells, cs, ox, oy, cs * 0.09, cs * 0.08);
      ctx.fillStyle = col; ctx.fill();
      ctx.clip();
      // vetas
      ctx.strokeStyle = shade(col, -0.22); ctx.lineWidth = Math.max(1, cs * 0.035);
      const seed = (cells[0][0] * 7 + cells[0][1] * 13) % 5;
      for (let k = 0; k < (b.y1 - b.y0) * 4 + 1; k++) {
        const y = oy + b.y0 * cs + (k + 0.5) * cs / 4;
        ctx.beginPath();
        for (let x = ox + b.x0 * cs; x <= ox + b.x1 * cs; x += cs / 4) {
          const yy = y + Math.sin(x / cs * 2.1 + k * 1.7 + seed) * cs * 0.05;
          if (x === ox + b.x0 * cs) ctx.moveTo(x, yy); else ctx.lineTo(x, yy);
        }
        ctx.stroke();
      }
      // nudo
      const [kx, ky] = cells[(seed + 1) % cells.length];
      ctx.beginPath(); ctx.ellipse(ox + (kx + 0.62) * cs, oy + (ky + 0.55) * cs, cs * 0.11, cs * 0.07, 0.3, 0, Math.PI * 2);
      ctx.fillStyle = shade(col, -0.3); ctx.fill();
      // luz arriba, sombra abajo
      const g = ctx.createLinearGradient(0, oy + b.y0 * cs, 0, oy + b.y1 * cs);
      g.addColorStop(0, 'rgba(255,240,210,.22)'); g.addColorStop(1, 'rgba(0,0,0,.18)');
      ctx.fillStyle = g; ctx.fillRect(ox + b.x0 * cs, oy + b.y0 * cs, (b.x1 - b.x0) * cs, (b.y1 - b.y0) * cs);
      ctx.restore();
    },

    neon(ctx, T, col, cells, cs, ox, oy) {
      ctx.save();
      ctx.shadowColor = col; ctx.shadowBlur = cs * 0.45;
      ctx.beginPath(); shapePath(ctx, cells, cs, ox, oy, cs * 0.08, cs * 0.18);
      ctx.fillStyle = col; ctx.fill();
      ctx.restore();
      ctx.beginPath(); shapePath(ctx, cells, cs, ox, oy, cs * 0.16, cs * 0.12);
      ctx.fillStyle = T.colores.tablero; ctx.fill();
      ctx.beginPath(); shapePath(ctx, cells, cs, ox, oy, cs * 0.16, cs * 0.12);
      ctx.fillStyle = rgba(col, 0.22); ctx.fill();
      ctx.beginPath(); shapePath(ctx, cells, cs, ox, oy, cs * 0.3, cs * 0.06);
      ctx.fillStyle = rgba(col, 0.18); ctx.fill();
    },

    regalo(ctx, T, col, cells, cs, ox, oy) {
      const b = bounds(cells), has = new Set(cells.map(c => c.join()));
      ctx.beginPath(); shapePath(ctx, cells, cs, ox, oy, cs * 0.05, cs * 0.16);
      ctx.fillStyle = shade(col, -0.35); ctx.fill();
      ctx.save();
      ctx.beginPath(); shapePath(ctx, cells, cs, ox, oy, cs * 0.1, cs * 0.12);
      const g = ctx.createLinearGradient(0, oy + b.y0 * cs, 0, oy + b.y1 * cs);
      g.addColorStop(0, shade(col, 0.15)); g.addColorStop(1, shade(col, -0.08));
      ctx.fillStyle = g; ctx.fill();
      ctx.clip();
      // lunares dorados
      ctx.fillStyle = 'rgba(255,230,150,.55)';
      for (const [x, y] of cells) {
        ctx.beginPath(); ctx.arc(ox + (x + 0.3) * cs, oy + (y + 0.7) * cs, cs * 0.05, 0, Math.PI * 2);
        ctx.arc(ox + (x + 0.72) * cs, oy + (y + 0.42) * cs, cs * 0.04, 0, Math.PI * 2); ctx.fill();
      }
      // nieve encima de las casillas que no tienen nada de la pieza arriba
      ctx.fillStyle = '#f7fbff';
      for (const [x, y] of cells) {
        if (has.has(x + ',' + (y - 1))) continue;
        const px = ox + x * cs, py = oy + y * cs;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + cs, py);
        ctx.lineTo(px + cs, py + cs * 0.24);
        for (let k = 4; k >= 0; k--) ctx.quadraticCurveTo(px + (k + 0.5) * cs / 5, py + cs * (k % 2 ? 0.4 : 0.3), px + k * cs / 5, py + cs * 0.24);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    },
  };

  function piece(ctx, T, type, cells, cs, ox, oy, alpha) {
    const col = T.piezas[type] || '#888888';
    if (alpha != null && alpha < 1) { ctx.save(); ctx.globalAlpha = alpha; }
    (STYLES[T.estilo] || STYLES.caramelo)(ctx, T, col, cells, cs, ox, oy);
    if (alpha != null && alpha < 1) ctx.restore();
  }

  // pieza en su forma inicial, centrada en (cx, cy) dentro de una caja de "size" casillas de ancho
  function mini(ctx, T, type, cx, cy, cs, alpha) {
    const cells = SHAPES[type].states[0];
    const b = bounds(cells);
    const ox = cx - (b.x0 + b.x1) / 2 * cs, oy = cy - (b.y0 + b.y1) / 2 * cs;
    piece(ctx, T, type, cells, cs, ox, oy, alpha);
  }

  // Tablero: fondo, puntos de la rejilla y piezas ya colocadas (agrupadas por pieza)
  function boardCanvas(G, T, cs, dpr) {
    const c = document.createElement('canvas');
    c.width = Math.round(COLS * cs * dpr); c.height = Math.round(VISIBLE * cs * dpr);
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    const w = COLS * cs, h = VISIBLE * cs;
    ctx.fillStyle = T.colores.tablero; ctx.fillRect(0, 0, w, h);
    if (T.tablero) T.tablero(ctx, w, h, cs);
    ctx.fillStyle = T.colores.rejilla;
    for (let y = 1; y < VISIBLE; y++) for (let x = 1; x < COLS; x++) {
      ctx.beginPath(); ctx.arc(x * cs, y * cs, Math.max(1, cs * 0.045), 0, Math.PI * 2); ctx.fill();
    }
    const groups = new Map();
    for (let y = HIDDEN; y < G.cells.length; y++) for (let x = 0; x < COLS; x++) {
      const v = G.cells[y][x];
      if (!v) continue;
      const id = G.ids[y][x];
      if (!groups.has(id)) groups.set(id, { t: v, cells: [] });
      groups.get(id).cells.push([x, y - HIDDEN]);
    }
    for (const gr of groups.values()) piece(ctx, T, TYPES[gr.t - 1] || 'gris', gr.cells, cs, 0, 0);
    return c;
  }

  // Marcas de aterrizaje: una raya bajo cada casilla de la pieza que toca el suelo, y un punto
  function landing(ctx, T, blocks, cs, ox, oy, t) {
    const has = new Set(blocks.map(b => b.join()));
    ctx.save();
    ctx.strokeStyle = T.colores.marca; ctx.fillStyle = T.colores.marca;
    ctx.lineWidth = Math.max(2, cs * 0.09); ctx.lineCap = 'round';
    ctx.globalAlpha = 0.55 + 0.25 * Math.sin(t * 5);
    for (const [x, y] of blocks) {
      const vy = y - HIDDEN;
      if (vy < 0) continue;
      const px = ox + x * cs, py = oy + vy * cs;
      ctx.beginPath(); ctx.arc(px + cs / 2, py + cs / 2, cs * 0.07, 0, Math.PI * 2); ctx.fill();
      if (!has.has(x + ',' + (y + 1))) { ctx.beginPath(); ctx.moveTo(px + cs * 0.22, py + cs * 0.93); ctx.lineTo(px + cs * 0.78, py + cs * 0.93); ctx.stroke(); }
    }
    ctx.restore();
  }

  // ---------- Partículas ----------
  // ambiente: nieve o chispas que flotan por la pantalla
  function makeAmbient(kind, w, h) {
    if (!kind) return null;
    const n = kind === 'nieve' ? 70 : 40, list = [];
    for (let k = 0; k < n; k++) list.push({ x: Math.random() * w, y: Math.random() * h, r: 1 + Math.random() * 2.6, v: 12 + Math.random() * 30, ph: Math.random() * 6 });
    return { kind, w, h, list };
  }
  function ambient(ctx, A, dt) {
    if (!A) return;
    const t = performance.now() / 1000;
    for (const p of A.list) {
      if (A.kind === 'nieve') {
        p.y += p.v * dt; p.x += Math.sin(t + p.ph) * 12 * dt;
        if (p.y > A.h + 5) { p.y = -5; p.x = Math.random() * A.w; }
        ctx.fillStyle = 'rgba(255,255,255,.75)';
      } else {
        p.y -= p.v * 0.4 * dt;
        if (p.y < -5) { p.y = A.h + 5; p.x = Math.random() * A.w; }
        ctx.fillStyle = `rgba(255,255,255,${0.15 + 0.2 * Math.sin(t * 2 + p.ph)})`;
      }
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
  }

  // confeti y polvo: lista de {x, y, vx, vy, life, max, color, s, rot, vr, kind}
  function burst(list, x, y, color, n, power, kind) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, v = power * (0.4 + Math.random() * 0.8);
      list.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - power * 0.6, life: 0, max: 0.7 + Math.random() * 0.6,
        color, s: 3 + Math.random() * 5, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 14, kind: kind || 'confeti' });
    }
  }
  function sparks(ctx, list, dt) {
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.life += dt;
      if (p.life >= p.max) { list.splice(i, 1); continue; }
      p.vy += (p.kind === 'polvo' ? 120 : 900) * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      const a = 1 - p.life / p.max;
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      if (p.kind === 'polvo') { ctx.beginPath(); ctx.arc(p.x, p.y, p.s * (1.4 - a * 0.6), 0, Math.PI * 2); ctx.fill(); }
      else if (p.kind === 'bloque') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.beginPath(); roundRect(ctx, -p.s / 2, -p.s / 2, p.s, p.s, p.s * 0.25); ctx.fill(); ctx.restore(); }
      else { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore(); }
    }
    ctx.globalAlpha = 1;
  }

  window.ENDibujo = { roundRect, shade, rgba, shapePath, piece, mini, boardCanvas, landing, makeAmbient, ambient, burst, sparks, STYLES };
})();
