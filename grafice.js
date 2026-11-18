// Grafice pe canvas, fără biblioteci externe (aplicația merge offline și fără dependențe).
// Graficele se redesenează singure la schimbarea lățimii și arată valoarea la atingere.

const CULORI_GRAFIC = {
  accent: '#B7F34A',
  grila: 'rgba(255,255,255,0.06)',
  text: '#8A919C',
  tooltip: '#232831',
};

const graficeActive = new Map(); // canvas -> { puncte, formateazaY }

const observatorGrafice = 'ResizeObserver' in window
  ? new ResizeObserver(intrari => {
    for (const i of intrari) {
      const g = graficeActive.get(i.target);
      if (g && i.contentRect.width > 0 && i.contentRect.width !== g.latime) deseneaza(i.target, g);
    }
  })
  : null;

// puncte: [{ x: timestamp, y: număr }] — sortate după x.
function deseneazaGrafic(canvas, puncte, formateazaY = formatNumar) {
  const g = { puncte, formateazaY, selectat: null, latime: 0 };
  if (!graficeActive.has(canvas)) {
    if (observatorGrafice) observatorGrafice.observe(canvas);
    const selecteaza = e => {
      const curent = graficeActive.get(canvas);
      if (!curent || !curent.geometrie || curent.puncte.length === 0) return;
      const r = canvas.getBoundingClientRect();
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
      let celMaiAproape = 0;
      curent.puncte.forEach((p, i) => {
        if (Math.abs(curent.geometrie.X(p.x) - x) < Math.abs(curent.geometrie.X(curent.puncte[celMaiAproape].x) - x)) celMaiAproape = i;
      });
      curent.selectat = celMaiAproape;
      deseneaza(canvas, curent);
    };
    canvas.addEventListener('pointerdown', selecteaza);
    canvas.addEventListener('pointermove', e => { if (e.buttons || e.pointerType === 'mouse') selecteaza(e); });
    canvas.addEventListener('pointerleave', () => {
      const curent = graficeActive.get(canvas);
      if (curent && curent.selectat !== null) { curent.selectat = null; deseneaza(canvas, curent); }
    });
  }
  graficeActive.set(canvas, g);
  deseneaza(canvas, g);
}

function deseneaza(canvas, g) {
  const { puncte, formateazaY } = g;
  const latime = canvas.clientWidth || 320;
  const inaltime = 190;
  g.latime = latime;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = latime * ratio;
  canvas.height = inaltime * ratio;
  canvas.style.height = inaltime + 'px';

  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, latime, inaltime);
  ctx.font = '11px Inter, system-ui, sans-serif';

  if (puncte.length === 0) {
    g.geometrie = null;
    ctx.fillStyle = CULORI_GRAFIC.text;
    ctx.textAlign = 'center';
    ctx.fillText('Nu sunt date încă', latime / 2, inaltime / 2);
    ctx.textAlign = 'left';
    return;
  }

  const pad = { l: 44, r: 14, t: 16, b: 26 };
  const xMin = puncte[0].x;
  const xMax = puncte[puncte.length - 1].x;
  let yMin = Math.min(...puncte.map(p => p.y));
  let yMax = Math.max(...puncte.map(p => p.y));
  if (yMin === yMax) { const d = Math.max(1, Math.abs(yMin) * 0.05); yMin -= d; yMax += d; }
  const marjaY = (yMax - yMin) * 0.12;
  yMin -= marjaY;
  yMax += marjaY;

  const areaL = latime - pad.l - pad.r;
  const areaI = inaltime - pad.t - pad.b;
  const X = x => xMax === xMin ? pad.l + areaL / 2 : pad.l + (x - xMin) / (xMax - xMin) * areaL;
  const Y = y => pad.t + (1 - (y - yMin) / (yMax - yMin)) * areaI;
  g.geometrie = { X, Y };

  // Grila orizontală și valorile de pe axa Y
  ctx.strokeStyle = CULORI_GRAFIC.grila;
  ctx.lineWidth = 1;
  ctx.fillStyle = CULORI_GRAFIC.text;
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= 3; i++) {
    const v = yMin + (yMax - yMin) * i / 3;
    const y = Math.round(Y(v)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(latime - pad.r, y);
    ctx.stroke();
    ctx.fillText(formateazaY(v), 4, y);
  }
  ctx.textBaseline = 'alphabetic';

  // Zona de sub linie, cu degrade
  const degrade = ctx.createLinearGradient(0, pad.t, 0, inaltime - pad.b);
  degrade.addColorStop(0, 'rgba(183,243,74,0.28)');
  degrade.addColorStop(1, 'rgba(183,243,74,0)');
  ctx.beginPath();
  puncte.forEach((p, i) => i === 0 ? ctx.moveTo(X(p.x), Y(p.y)) : ctx.lineTo(X(p.x), Y(p.y)));
  ctx.lineTo(X(puncte[puncte.length - 1].x), inaltime - pad.b);
  ctx.lineTo(X(puncte[0].x), inaltime - pad.b);
  ctx.closePath();
  ctx.fillStyle = degrade;
  ctx.fill();

  // Linia
  ctx.strokeStyle = CULORI_GRAFIC.accent;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  puncte.forEach((p, i) => i === 0 ? ctx.moveTo(X(p.x), Y(p.y)) : ctx.lineTo(X(p.x), Y(p.y)));
  ctx.stroke();

  // Punctele (doar când nu sunt prea dese)
  if (areaL / puncte.length > 8) {
    for (const p of puncte) {
      ctx.beginPath();
      ctx.arc(X(p.x), Y(p.y), 3, 0, Math.PI * 2);
      ctx.fillStyle = '#0B0D10';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = CULORI_GRAFIC.accent;
      ctx.stroke();
    }
  }

  // Datele de la capete
  const scurta = t => new Date(t).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit' });
  ctx.fillStyle = CULORI_GRAFIC.text;
  ctx.fillText(scurta(xMin), pad.l, inaltime - 8);
  if (xMax !== xMin) {
    const eticheta = scurta(xMax);
    ctx.fillText(eticheta, latime - pad.r - ctx.measureText(eticheta).width, inaltime - 8);
  }

  // Punctul atins: linie verticală și valoarea
  if (g.selectat !== null && puncte[g.selectat]) {
    const p = puncte[g.selectat];
    const px = X(p.x);
    const py = Y(p.y);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(px, pad.t);
    ctx.lineTo(px, inaltime - pad.b);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(px, py, 5, 0, Math.PI * 2);
    ctx.fillStyle = CULORI_GRAFIC.accent;
    ctx.fill();

    ctx.font = '600 12px Inter, system-ui, sans-serif';
    const text = `${formateazaY(p.y)} · ${scurta(p.x)}`;
    const w = ctx.measureText(text).width + 16;
    const bx = Math.min(Math.max(px - w / 2, 2), latime - w - 2);
    const by = Math.max(py - 34, 2);
    ctx.fillStyle = CULORI_GRAFIC.tooltip;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx, by, w, 24, 8); else ctx.rect(bx, by, w, 24);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(text, bx + 8, by + 16);
  }
}
