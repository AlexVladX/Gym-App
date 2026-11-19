// Geometrie de bază pentru ilustrații: cadre de oase, curbe netede, formatare compactă.
'use strict';

const rad = d => d * Math.PI / 180;
const dir = a => [Math.cos(rad(a)), Math.sin(rad(a))];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const unghi = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
// o zecimală: suficient pentru claritate la orice mărime și fișiere mici
let scala = 10;
const precizie = zecimale => { scala = 10 ** zecimale; };
const f = n => { const r = Math.round(n * scala) / scala; return (Object.is(r, -0) ? 0 : r).toString(); };
const P = p => `${f(p[0])},${f(p[1])}`;

// Cadrul unui os: origine, unghi (0 = dreapta, 90 = jos), lungime.
// Punct local (t, y): t = fracție din lungime, y = distanță pe perpendiculara n = (-dy, dx).
function cadru(origine, ung, lung) {
  const d = dir(ung);
  const n = [-d[1], d[0]];
  return { o: origine, d, n, L: lung, unghi: ung, p: (t, y) => add(add(origine, mul(d, t * lung)), mul(n, y)) };
}

function curba(pts, inchisa = true, tensiune = 0.5) {
  const n = pts.length;
  if (n < 2) return '';
  let s = `M${P(pts[0])}`;
  const ultim = inchisa ? n : n - 1;
  for (let i = 0; i < ultim; i++) {
    const p0 = inchisa ? pts[(i - 1 + n) % n] : pts[Math.max(i - 1, 0)];
    const p1 = pts[i], p2 = pts[(i + 1) % n];
    const p3 = inchisa ? pts[(i + 2) % n] : pts[Math.min(i + 2, n - 1)];
    const c1 = [p1[0] + (p2[0] - p0[0]) * tensiune / 3, p1[1] + (p2[1] - p0[1]) * tensiune / 3];
    const c2 = [p2[0] - (p3[0] - p1[0]) * tensiune / 3, p2[1] - (p3[1] - p1[1]) * tensiune / 3];
    s += `C${P(c1)} ${P(c2)} ${P(p2)}`;
  }
  return inchisa ? s + 'Z' : s;
}
const curbaInchisa = (pts, t) => curba(pts, true, t);
const curbaDeschisa = (pts, t) => curba(pts, false, t);
const poligon = pts => `M${pts.map(P).join('L')}Z`;
const linie = pts => `M${pts.map(P).join('L')}`;

// Lățimea profilului la poziția t, pe partea semn (−1: prima coloană, +1: a doua).
function latime(profil, t, semn) {
  const k = semn < 0 ? 1 : 2;
  if (t <= profil[0][0]) return profil[0][k];
  for (let i = 1; i < profil.length; i++) {
    if (t <= profil[i][0]) {
      const a = profil[i - 1], b = profil[i];
      const u = (t - a[0]) / (b[0] - a[0]);
      return a[k] + (b[k] - a[k]) * u;
    }
  }
  return profil[profil.length - 1][k];
}

module.exports = { precizie, rad, dir, add, sub, mul, lerp, dist, unghi, f, P, cadru, curba, curbaInchisa, curbaDeschisa, poligon, linie, latime };
