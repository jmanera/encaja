// Tema Madera: piezas de madera pintada, con vetas y nudos.
(window.ENTemas = window.ENTemas || []).push({
  id: 'madera',
  nombre: 'Madera',
  descripcion: 'Bloques de madera pintada',
  estilo: 'madera',
  colores: { fondo: '#1e140d', tablero: '#33241a', rejilla: 'rgba(255,220,170,.10)', borde: '#9c6b3f',
             marca: '#ffe0b0', texto: '#fbefdf', acento: '#e0a458', panel: '#2a1d14' },
  piezas: { I: '#3f8f8a', O: '#c0553a', T: '#d9a441', S: '#6f8f3a', Z: '#8a5a9e', J: '#c47a3d', L: '#3e6d9c' },
  confeti: ['#d9a441', '#c47a3d', '#8d5a35', '#e8c99b'],
  particulas: null,
  // tablas del fondo
  tablero(ctx, w, h, cs) {
    ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 1;
    for (let x = cs * 2.5; x < w; x += cs * 2.5) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  },
});
