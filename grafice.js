// Grafice pe canvas, fără biblioteci externe (aplicația merge offline și fără dependențe).
// Graficele se redesenează singure la schimbarea lățimii și arată valoarea la atingere.

const CULORI_GRAFIC = {
  accent: '#B7F34A',
  grila: 'rgba(255,255,255,0.06)',
  text: '#8A919C',
  tooltip: '#232831',
};

const graficeActive = new Map(); // canvas -> { tip, puncte | bare, formateazaY, inaltime }

const observatorGrafice = 'ResizeObserver' in window
  ? new ResizeObserver(intrari => {
    for (const i of intrari) {
      const g = graficeActive.get(i.target);
      if (g && i.contentRect.width > 0 && i.contentRect.width !== g.latime) redeseneaza(i.target, g);
    }
  })
  : null;

// Atingerea sau mouse-ul selectează elementul cel mai apropiat pe orizontală și îi arată valoarea.
function ataseazaInteractiune(canvas) {
  if (graficeActive.has(canvas)) return;
  if (observatorGrafice) observatorGrafice.observe(canvas);
  const selecteaza = e => {
    const g = graficeActive.get(canvas);
    if (!g || !g.pozitii || g.pozitii.length === 0) return;
    const x = e.clientX - canvas.getBoundingClientRect().left;
    let cel = 0;
    g.pozitii.forEach((px, i) => { if (Math.abs(px - x) < Math.abs(g.pozitii[cel] - x)) cel = i; });
    if (g.selectat !== cel) { g.selectat = cel; redeseneaza(canvas, g); }
  };
  canvas.addEventListener('pointerdown', selecteaza);
  canvas.addEventListener('pointermove', e => { if (e.buttons || e.pointerType === 'mouse') selecteaza(e); });
  canvas.addEventListener('pointerleave', () => {
    const g = graficeActive.get(canvas);
    if (g && g.selectat !== null) { g.selectat = null; redeseneaza(canvas, g); }
  });
}

function redeseneaza(canvas, g) {
  if (g.tip === 'bare') deseneazaBareIntern(canvas, g); else deseneaza(canvas, g);
}

// Pregătește canvas-ul pentru densitatea ecranului și întoarce contextul.
function pregatesteCanvas(canvas, g) {
  const latime = canvas.clientWidth || 320;
  g.latime = latime;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = latime * ratio;
  canvas.height = g.inaltime * ratio;
  canvas.style.height = g.inaltime + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, latime, g.inaltime);
  ctx.font = '11px Inter, system-ui, sans-serif';
  return { ctx, latime, inaltime: g.inaltime };
}

// Eticheta cu valoarea elementului atins.
function deseneazaEticheta(ctx, text, px, py, latime) {
  ctx.font = '600 12px Inter, system-ui, sans-serif';
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

// Grafic cu linie. puncte: [{ x: timestamp, y: număr }] — sortate după x.
// optiuni: { inaltime } (implicit 190 px)
function deseneazaGrafic(canvas, puncte, formateazaY = formatNumar, optiuni = {}) {
  ataseazaInteractiune(canvas);
  // optiuni.brute: valori individuale afișate ca puncte discrete sub linie (ex. cântăririle, sub media pe 7 zile)
  const g = { tip: 'linie', puncte, formateazaY, selectat: null, latime: 0, inaltime: optiuni.inaltime || 190, brute: optiuni.brute || [] };
  graficeActive.set(canvas, g);
  deseneaza(canvas, g);
}

function deseneaza(canvas, g) {
  const { puncte, formateazaY } = g;
  const { ctx, latime, inaltime } = pregatesteCanvas(canvas, g);

  if (puncte.length === 0) {
    g.pozitii = [];
    ctx.fillStyle = CULORI_GRAFIC.text;
    ctx.textAlign = 'center';
    ctx.fillText('Nu sunt date încă', latime / 2, inaltime / 2);
    ctx.textAlign = 'left';
    return;
  }

  const pad = { l: 44, r: 14, t: 16, b: 26 };
  const xMin = puncte[0].x;
  const xMax = puncte[puncte.length - 1].x;
  const toateY = [...puncte, ...(g.brute || [])].map(p => p.y);
  let yMin = Math.min(...toateY);
  let yMax = Math.max(...toateY);
  if (yMin === yMax) { const d = Math.max(1, Math.abs(yMin) * 0.05); yMin -= d; yMax += d; }
  const marjaY = (yMax - yMin) * 0.12;
  yMin -= marjaY;
  yMax += marjaY;

  const areaL = latime - pad.l - pad.r;
  const areaI = inaltime - pad.t - pad.b;
  const X = x => xMax === xMin ? pad.l + areaL / 2 : pad.l + (x - xMin) / (xMax - xMin) * areaL;
  const Y = y => pad.t + (1 - (y - yMin) / (yMax - yMin)) * areaI;
  g.pozitii = puncte.map(p => X(p.x));

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

  // Valorile individuale, discret
  for (const p of g.brute || []) {
    if (p.x < xMin || p.x > xMax) continue;
    ctx.beginPath();
    ctx.arc(X(p.x), Y(p.y), 2.2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(200,208,218,0.45)';
    ctx.fill();
  }

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

    deseneazaEticheta(ctx, `${formateazaY(p.y)} · ${scurta(p.x)}`, px, py, latime);
  }
}

// Grafic cu bare verticale.
// bare: [{ eticheta: text sub bară, valoare: număr, detaliu: text pentru eticheta de la atingere, evidentiata: bool }]
// optiuni: { inaltime } (implicit 170 px)
function deseneazaBare(canvas, bare, formateaza = formatNumar, optiuni = {}) {
  ataseazaInteractiune(canvas);
  const g = { tip: 'bare', bare, formateazaY: formateaza, selectat: null, latime: 0, inaltime: optiuni.inaltime || 170 };
  graficeActive.set(canvas, g);
  deseneazaBareIntern(canvas, g);
}

function deseneazaBareIntern(canvas, g) {
  const { bare, formateazaY } = g;
  const { ctx, latime, inaltime } = pregatesteCanvas(canvas, g);
  const pad = { l: 8, r: 8, t: 22, b: 24 };
  const max = Math.max(0, ...bare.map(b => b.valoare));
  const areaL = latime - pad.l - pad.r;
  const areaI = inaltime - pad.t - pad.b;
  const pas = bare.length ? areaL / bare.length : areaL;
  const latimeBara = Math.min(36, pas * 0.62);
  g.pozitii = bare.map((_, i) => pad.l + pas * i + pas / 2);

  // Linia de bază
  ctx.strokeStyle = CULORI_GRAFIC.grila;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad.l, inaltime - pad.b + 0.5);
  ctx.lineTo(latime - pad.r, inaltime - pad.b + 0.5);
  ctx.stroke();

  ctx.textAlign = 'center';
  // când barele sunt multe, etichetele se răresc (numărate de la ultima bară, care rămâne mereu etichetată)
  ctx.font = '11px Inter, system-ui, sans-serif';
  const latEticheta = Math.max(0, ...bare.map(b => ctx.measureText(b.eticheta || '').width)) + 8;
  const pasEtichete = Math.max(1, Math.ceil(latEticheta / pas));
  bare.forEach((b, i) => {
    const cx = g.pozitii[i];
    const h = max > 0 ? Math.max(b.valoare > 0 ? 4 : 0, b.valoare / max * areaI) : 0;
    const x = cx - latimeBara / 2;
    const y = inaltime - pad.b - h;
    const selectata = g.selectat === i;
    ctx.fillStyle = b.evidentiata || selectata ? CULORI_GRAFIC.accent : 'rgba(183,243,74,0.35)';
    if (h > 0) {
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, y, latimeBara, h, [6, 6, 2, 2]); else ctx.rect(x, y, latimeBara, h);
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(x, inaltime - pad.b - 2, latimeBara, 2);
    }
    ctx.fillStyle = b.evidentiata ? '#FFFFFF' : CULORI_GRAFIC.text;
    ctx.font = (b.evidentiata ? '600 ' : '') + '11px Inter, system-ui, sans-serif';
    if ((bare.length - 1 - i) % pasEtichete === 0) ctx.fillText(b.eticheta, cx, inaltime - 8);
  });
  ctx.textAlign = 'left';

  if (max === 0) {
    ctx.fillStyle = CULORI_GRAFIC.text;
    ctx.textAlign = 'center';
    ctx.font = '12px Inter, system-ui, sans-serif';
    ctx.fillText('Nicio activitate în această perioadă', latime / 2, pad.t + areaI / 2);
    ctx.textAlign = 'left';
  }

  if (g.selectat !== null && bare[g.selectat]) {
    const b = bare[g.selectat];
    const h = max > 0 ? b.valoare / max * areaI : 0;
    deseneazaEticheta(ctx, `${formateazaY(b.valoare)}${b.detaliu ? ' · ' + b.detaliu : ''}`, g.pozitii[g.selectat], inaltime - pad.b - h, latime);
  }
}
