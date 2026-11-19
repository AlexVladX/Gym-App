// Compunerea unei ilustrații: una sau două poziții (start → final) așezate una lângă alta,
// aliniate pe un reper comun (de obicei solul), cu echipamentul pe straturi și săgeata mișcării.
'use strict';
const { Pictura } = require('./pictura');
const Corp = require('./corp');
const { f, curbaDeschisa, add, mul, sub } = require('./geom');

const SAGEATA = '#D4FF7A';

// Săgeată punctată (dublă implicit) printr-o listă de puncte.
function sageata(pts, { dubla = true, culoare = SAGEATA } = {}) {
  const varf = (p, q) => {
    const dx = p[0] - q[0], dy = p[1] - q[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
    const a = [p[0] - ux * 5 + uy * 3.3, p[1] - uy * 5 - ux * 3.3], b = [p[0] - ux * 5 - uy * 3.3, p[1] - uy * 5 + ux * 3.3];
    return `M${f(a[0])},${f(a[1])}L${f(p[0])},${f(p[1])}L${f(b[0])},${f(b[1])}`;
  };
  const n = pts.length;
  let capete = varf(pts[n - 1], pts[n - 2]);
  if (dubla) capete += varf(pts[0], pts[1]);
  return `<g fill="none" stroke="${culoare}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">`
    + `<path d="${curbaDeschisa(pts)}" stroke-dasharray="0.1 3.3"/><path d="${capete}"/></g>`;
}
function arc(c, r, a0, a1, opt) {
  const pts = [];
  for (let i = 0; i <= 18; i++) { const a = (a0 + (a1 - a0) * i / 18) * Math.PI / 180; pts.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]); }
  return sageata(pts, opt);
}
// Săgeată dreaptă de la a la b, deplasată perpendicular cu „lateral".
function dreapta(a, b, lateral = 0, opt) {
  const d = sub(b, a), L = Math.hypot(d[0], d[1]) || 1, n = [-d[1] / L, d[0] / L];
  return sageata([add(a, mul(n, lateral)), add(b, mul(n, lateral))], opt);
}

const ORDINE = {
  lateral: ['fund', 'departe', 'spate', 'trunchi', 'mijloc', 'picior', 'fata', 'brat', 'sus'],
  frontal: ['fund', 'picioare', 'spate', 'trunchi', 'mijloc', 'brate', 'fata', 'sus'],
};

// pozitie: { corp (din Corp.lateral / Corp.frontal), niv, echip: (r, pic, corp) → [{ strat, svg, puncte }],
//            sol: y sau null, ancora: y, sageata: (r, rStart) → svg }
function deseneazaPozitie(poz, pic, lod, rAltele) {
  const corp = poz.corp;
  const pc = Corp.piese(corp, lod);
  const r = Corp.repere(corp);
  const straturi = {};
  const tip = corp.vedere === 'lateral' ? 'lateral' : 'frontal';
  const ctx = { pictura: pic, niv: poz.niv, lod };
  if (tip === 'lateral') {
    straturi.departe = Corp.strat(pc.departe, { ...ctx, departe: true });
    straturi.trunchi = Corp.strat(pc.trunchi, ctx);
    straturi.picior = Corp.strat(pc.picior, ctx);
    straturi.brat = Corp.strat(pc.brat, ctx);
  } else {
    straturi.picioare = Corp.strat(pc.picioare, ctx);
    straturi.trunchi = Corp.strat(pc.trunchi, ctx);
    straturi.brate = Corp.strat(pc.brate, ctx);
  }
  const puncte = Corp.puncteCorp(pc);
  const echip = poz.echip ? poz.echip(r, pic, corp, lod) : [];
  for (const e of [].concat(echip).flat(4).filter(Boolean)) {
    straturi[e.strat] = (straturi[e.strat] || '') + e.svg;
    if (e.puncte) puncte.push(...e.puncte);
  }
  const solImplicit = Math.max(...puncte.map(p => p[1]));
  let sag = '';
  if (poz.sageata && lod === 'detaliu') {
    sag = poz.sageata(r, rAltele, corp);
    if (sag && typeof sag === 'object') { puncte.push(...(sag.puncte || [])); sag = sag.svg; }
    // capetele săgeții intră în încadrare
    for (const m of (sag || '').matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)) puncte.push([+m[1], +m[2]]);
  }
  const svg = ORDINE[tip].map(k => straturi[k] || '').join('') + sag;
  const sol = poz.sol === null ? null : (poz.sol ?? solImplicit);
  return { svg, puncte, sol, ancora: poz.ancora ?? sol, r };
}

const PAR = '<linearGradient id="par" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#4C525B"/><stop offset="1" stop-color="#1D2025"/></linearGradient>';

// pozitii: lista de poziții; raport: lățime/înălțime a imaginii finale.
function compune(pozitii, { lod = 'detaliu', raport = 1.6, spatiu = 22, margine = 8, eticheta = '' } = {}) {
  const pic = new Pictura('');
  const r0 = pozitii.map(p => Corp.repere(p.corp));
  const desene = pozitii.map((p, i) => deseneazaPozitie(p, pic, lod, r0[i === 0 ? 1 : 0] || r0[0]));
  const ancora = Math.max(...desene.map(d => d.ancora));
  let x = 0, svg = '';
  let yMin = Infinity, yMax = -Infinity;
  const soluri = [];
  for (const d of desene) {
    const xs = d.puncte.map(p => p[0]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    const dx = x - x0, dy = ancora - d.ancora;
    svg += `<g transform="translate(${f(dx)},${f(dy)})">${d.svg}</g>`;
    for (const p of d.puncte) { yMin = Math.min(yMin, p[1] + dy); yMax = Math.max(yMax, p[1] + dy); }
    if (d.sol !== null) soluri.push({ y: d.sol + dy, x0: x, x1: x + (x1 - x0) });
    x += (x1 - x0) + spatiu;
  }
  const w = x - spatiu;
  // solul: o linie discretă sub fiecare poziție care stă pe ceva
  let solSvg = '';
  if (soluri.length) {
    const y = Math.max(...soluri.map(s => s.y));
    yMax = Math.max(yMax, y);
    solSvg = `<path d="M${f(-margine * 0.6)},${f(y + 0.4)}H${f(w + margine * 0.6)}" stroke="rgba(255,255,255,0.10)" stroke-width="0.9"/>`;
  }
  // cutia de încadrare, completată la raportul cerut (fără deformare)
  let bx = -margine, by = yMin - margine, bw = w + 2 * margine, bh = (yMax - yMin) + 2 * margine;
  if (bw / bh > raport) { const nh = bw / raport; by -= (nh - bh) / 2; bh = nh; } else { const nw = bh * raport; bx -= (nw - bw) / 2; bw = nw; }
  const titlu = eticheta ? `<title>${eticheta.replace(/[<>&"]/g, '')}</title>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(bx)} ${f(by)} ${f(bw)} ${f(bh)}">${titlu}${pic.text().replace('<defs>', `<defs>${PAR}`)}${solSvg}${svg}</svg>`;
}

module.exports = { compune, sageata, arc, dreapta, SAGEATA };
