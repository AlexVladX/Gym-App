// Echipamentul: bare, gantere, discuri, bănci, scripeți, aparate. Fiecare funcție întoarce
// { strat, svg, puncte } — stratul spune unde se desenează față de corp (vezi compune.js).
'use strict';
const { cadru, curbaInchisa, poligon, f, P, add, sub, mul, dist, unghi, lerp } = require('./geom');

const MARGINE = '#0F1114';
const LINIE = 'rgba(205,212,220,0.55)';

// Dreptunghi rotunjit de la a la b, cu grosimea gros (centrat pe linia a–b, sau pe o parte: parte = ±1).
function bandaPuncte(a, b, gros, parte = 0, raza = 1.5) {
  const ung = unghi(a, b);
  const L = dist(a, b);
  const c = cadru(a, ung, L);
  const y0 = parte === 0 ? -gros / 2 : parte > 0 ? 0 : -gros;
  const y1 = y0 + gros;
  const r = Math.min(raza, gros / 2, L / 2);
  const rt = r / (L || 1);
  return [c.p(rt, y0), c.p(1 - rt, y0), c.p(1, y0 + r), c.p(1, y1 - r), c.p(1 - rt, y1), c.p(rt, y1), c.p(0, y1 - r), c.p(0, y0 + r)];
}
function banda(pic, a, b, gros, { parte = 0, raza = 1.5, ton = 'tapiterie', strat = 'fund', contur = LINIE, latimeContur = 0.6 } = {}) {
  const pts = bandaPuncte(a, b, gros, parte, raza);
  const c = cadru(a, unghi(a, b), dist(a, b));
  const y = parte === 0 ? 0 : parte * gros / 2;
  // umbrire perpendiculară pe bandă
  const umbra = pic.degrade(c.p(0.5, y - gros / 2), c.p(0.5, y + gros / 2), ton);
  return { strat, svg: `<path d="${curbaInchisa(pts, 0.25)}" fill="${umbra}" stroke="${contur}" stroke-width="${latimeContur}"/>`, puncte: pts };
}
// Tijă metalică (stâlp, bară, mâner).
function tija(pic, a, b, gros = 2.2, strat = 'fund', ton = 'metal') {
  return banda(pic, a, b, gros, { raza: gros / 2, ton, strat, contur: MARGINE, latimeContur: 0.4 });
}

// Disc de greutate văzut din lateral (cerc), cu manșonul barei în centru.
function disc(pic, c, r, strat = 'fund', grosime = 1) {
  let s = '';
  for (let i = grosime; i >= 0; i--) {
    const cc = add(c, [i * 1.5, -i * 0.5]);
    s += `<circle cx="${f(cc[0])}" cy="${f(cc[1])}" r="${f(r)}" fill="${pic.lumina(cc, r, 'disc')}" stroke="#8C949E" stroke-width="0.6"/>`;
  }
  s += `<circle cx="${f(c[0])}" cy="${f(c[1])}" r="${f(r * 0.66)}" fill="none" stroke="rgba(255,255,255,0.10)" stroke-width="0.6"/>`
    + `<circle cx="${f(c[0])}" cy="${f(c[1])}" r="${f(r * 0.32)}" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="0.5"/>`
    + `<circle cx="${f(c[0])}" cy="${f(c[1])}" r="${f(Math.max(1.5, r * 0.13))}" fill="${pic.lumina(c, 2, 'metal')}" stroke="${MARGINE}" stroke-width="0.4"/>`;
  return { strat, svg: s, puncte: [[c[0] - r, c[1] - r], [c[0] + r + grosime * 1.5, c[1] + r]] };
}

// Bara cu discuri văzută din capăt (lateral): discul mare.
const haltera = (pic, c, strat = 'fund', r = 20) => disc(pic, c, r, strat, 1);

// Bara văzută din față (frontal): bara orizontală, discuri la capete.
function halteraFrontala(pic, c, { latime = 112, ung = 0, r = 20, strat = 'mijloc', ez = false } = {}) {
  const cad = cadru(c, ung, 1);
  const p = x => add(c, mul(cad.d, x));
  const out = [];
  if (ez) {
    // bara EZ: porțiunea din mijloc ondulată
    const pts = [];
    for (let x = -24; x <= 24; x += 2) pts.push(add(p(x), mul(cad.n, Math.sin(x / 24 * Math.PI * 2) * 1.6)));
    out.push(tija(pic, p(-latime / 2), p(-24), 2.2, strat), tija(pic, p(24), p(latime / 2), 2.2, strat));
    out.push({ strat, svg: `<path d="M${pts.map(P).join('L')}" fill="none" stroke="#C9CFD6" stroke-width="2.2" stroke-linecap="round"/>`, puncte: pts });
  } else {
    out.push(tija(pic, p(-latime / 2), p(latime / 2), 2.2, strat));
  }
  for (const s of [-1, 1]) {
    const x = s * (latime / 2 - 7);
    out.push(banda(pic, p(x - 2.6 * s), p(x + 2.6 * s), r * 2, { ton: 'disc', strat, raza: 1.2, contur: '#8C949E' }));
    out.push(banda(pic, p(x + 3.6 * s), p(x + 7 * s), r * 1.6, { ton: 'disc', strat, raza: 1, contur: '#8C949E' }));
  }
  return out;
}

// Ganteră: axa = unghiul mânerului în imagine; null = văzută din capăt (cerc).
function gantera(pic, c, axa = null, strat = 'fata', r = 6.2) {
  if (axa === null) return disc(pic, c, r, strat, 2);
  const cad = cadru(c, axa, 1);
  const p = x => add(c, mul(cad.d, x));
  return [
    tija(pic, p(-6), p(6), 2.4, strat),
    banda(pic, p(-11.5), p(-5.2), r * 2, { ton: 'disc', strat, raza: 2.2, contur: '#8C949E' }),
    banda(pic, p(5.2), p(11.5), r * 2, { ton: 'disc', strat, raza: 2.2, contur: '#8C949E' }),
  ];
}

// Kettlebell / greutate de mână (pentru farmer's walk folosim gantere grele).

// Bancă: suprafață de la a la b (sus), cu grosimea 6 și picioare până la sol.
function banca(pic, a, b, sol, { picioare = true, gros = 6.5, strat = 'fund', parte = 1 } = {}) {
  const out = [banda(pic, a, b, gros, { parte, strat, raza: 2.6 })];
  if (picioare) {
    const jos = Math.max(a[1], b[1]) + gros;
    const x0 = Math.min(a[0], b[0]) + 6, x1 = Math.max(a[0], b[0]) - 8;
    for (const x of [x0, x1]) out.push(tija(pic, [x, Math.min(jos, sol)], [x, sol], 3.4, strat, 'cadru'));
    out.push(tija(pic, [x0 - 6, sol - 1.4], [x0 + 6, sol - 1.4], 2.6, strat, 'cadru'), tija(pic, [x1 - 6, sol - 1.4], [x1 + 6, sol - 1.4], 2.6, strat, 'cadru'));
  }
  return out;
}

// Bancă reglabilă: șezut orizontal + spătar înclinat (unghi în grade față de orizontală, spre stânga).
function bancaReglabila(pic, sezutA, sezutB, spatarLung, spatarUnghi, sol, strat = 'fund') {
  // spătarul pornește din capătul stâng al șezutului și urcă spre stânga
  const baza = sezutA;
  const varf = add(baza, mul([Math.cos(Math.PI - spatarUnghi * Math.PI / 180), -Math.sin(spatarUnghi * Math.PI / 180)], spatarLung));
  const out = [
    banda(pic, varf, baza, 6.5, { parte: -1, strat, raza: 2.6 }),
    banda(pic, sezutA, sezutB, 6.5, { parte: 1, strat, raza: 2.6 }),
  ];
  const sub1 = [lerp(baza, varf, 0.5)[0], lerp(baza, varf, 0.5)[1] + 4];
  out.push(tija(pic, [baza[0] + 2, baza[1] + 6], [baza[0] + 2, sol], 3.4, strat, 'cadru'));
  out.push(tija(pic, sub1, [baza[0] + 2, sol - 8], 2.6, strat, 'cadru'));
  out.push(tija(pic, [sezutB[0] - 6, sezutB[1] + 6], [sezutB[0] - 6, sol], 3.4, strat, 'cadru'));
  out.push(tija(pic, [baza[0] - 10, sol - 1.4], [sezutB[0], sol - 1.4], 2.6, strat, 'cadru'));
  return out;
}

// Turnul de scripete: stâlp vertical la x, rola la înălțimea yRola, cablul până la mână, mânerul.
function scripete(pic, { x, yRola, mana, sol, sus, strat = 'fund', stratCablu = 'spate', maner = 'd', latimeTurn = 9, partea = 1, stiva = true }) {
  const out = [];
  const top = sus ?? Math.min(yRola - 14, mana[1] - 20);
  out.push(banda(pic, [x, top], [x, sol], latimeTurn, { ton: 'cadru', strat, raza: 1.2, contur: 'rgba(205,212,220,0.35)' }));
  if (stiva) {
    // stiva de greutăți, în partea de jos a turnului
    const sx = x - partea * (latimeTurn / 2 + 7);
    out.push(banda(pic, [sx, sol - 34], [sx, sol - 4], 11, { ton: 'disc', strat, raza: 1.2, contur: '#59616B' }));
    let linii = '';
    for (let i = 1; i < 6; i++) linii += `M${f(sx - 5.5)},${f(sol - 4 - i * 5)}h11`;
    out.push({ strat, svg: `<path d="${linii}" stroke="rgba(255,255,255,0.12)" stroke-width="0.6"/>`, puncte: [] });
    out.push(tija(pic, [sx, top + 4], [sx, sol - 34], 0.8, strat));
  }
  const rola = [x - partea * 1, yRola];
  out.push({ strat, svg: `<circle cx="${f(rola[0])}" cy="${f(rola[1])}" r="3.6" fill="${pic.lumina(rola, 3.6, 'metal')}" stroke="${MARGINE}" stroke-width="0.5"/><circle cx="${f(rola[0])}" cy="${f(rola[1])}" r="1.1" fill="#2A2E34"/>`, puncte: [] });
  out.push({ strat: stratCablu, svg: `<path d="M${P(rola)}L${P(mana)}" stroke="#BFC6CE" stroke-width="0.9" stroke-linecap="round"/>`, puncte: [] });
  out.push(...manerScripete(pic, maner, mana, unghi(rola, mana)));
  return out;
}

// Mânerele de scripete, desenate la mână (strat „fata").
function manerScripete(pic, tip, c, directieCablu, strat = 'fata') {
  if (tip === 'franghie') {
    const cad = cadru(c, directieCablu, 1);
    const capat = s => add(add(c, mul(cad.d, 7)), mul(cad.n, s * 2.2));
    return [
      { strat, svg: `<path d="M${P(add(c, mul(cad.d, -3)))}L${P(capat(-1))}M${P(add(c, mul(cad.d, -3)))}L${P(capat(1))}" stroke="#2F3339" stroke-width="2.6" stroke-linecap="round"/><path d="M${P(add(c, mul(cad.d, -3)))}L${P(capat(-1))}M${P(add(c, mul(cad.d, -3)))}L${P(capat(1))}" stroke="#7C848E" stroke-width="1.2" stroke-linecap="round" stroke-dasharray="1 1"/>`, puncte: [] },
      { strat, svg: `<circle cx="${f(capat(-1)[0])}" cy="${f(capat(-1)[1])}" r="1.7" fill="#22262B"/><circle cx="${f(capat(1)[0])}" cy="${f(capat(1)[1])}" r="1.7" fill="#22262B"/>`, puncte: [] },
    ];
  }
  if (tip === 'bara') return [disc(pic, c, 1.9, strat, 0)];
  if (tip === 'v') {
    const cad = cadru(c, directieCablu, 1);
    return [tija(pic, add(c, mul(cad.d, -5)), add(c, mul(cad.n, 3)), 1.8, strat), tija(pic, add(c, mul(cad.d, -5)), add(c, mul(cad.n, -3)), 1.8, strat)];
  }
  if (tip === 'glezna') return [];
  // mâner D: inel mic în jurul pumnului
  return [{ strat, svg: `<circle cx="${f(c[0])}" cy="${f(c[1])}" r="3.4" fill="none" stroke="#C9CFD6" stroke-width="1.1"/>`, puncte: [] }];
}

// Bara de tracțiuni / bara fixă: din lateral e un cerc pe un stâlp; din față, o bară lungă.
function baraFixaLaterala(pic, c, sol) {
  return [
    tija(pic, [c[0] + 34, c[1] - 6], [c[0] + 34, sol], 4, 'fund', 'cadru'),
    tija(pic, [c[0] - 2, c[1]], [c[0] + 34, c[1] - 1], 2.4, 'fund', 'cadru'),
    { strat: 'fata', svg: `<circle cx="${f(c[0])}" cy="${f(c[1])}" r="2.4" fill="${pic.lumina(c, 2.4, 'metal')}" stroke="${MARGINE}" stroke-width="0.5"/>`, puncte: [[c[0] - 3, c[1] - 3]] },
  ];
}
function baraFixaFrontala(pic, y, x0, x1, strat = 'fund') {
  return [tija(pic, [x0, y], [x1, y], 2.6, strat), tija(pic, [x0, y - 8], [x0, y + 2], 3.4, strat, 'cadru'), tija(pic, [x1, y - 8], [x1, y + 2], 3.4, strat, 'cadru')];
}

// Saltea pe sol.
function saltea(pic, x0, x1, sol) {
  return banda(pic, [x0, sol - 2.4], [x1, sol - 2.4], 2.4, { ton: 'tapiterie', strat: 'fund', raza: 1.2, parte: 1 });
}

// Cutie / treaptă.
function cutie(pic, x0, x1, y, sol, strat = 'fund') {
  return banda(pic, [x0, y], [x1, y], sol - y, { parte: 1, ton: 'tapiterie', strat, raza: 1.5 });
}

// Stâlp vertical de aparat (cadru metalic gros).
const stalp = (pic, a, b, gros = 4.4, strat = 'fund') => tija(pic, a, b, gros, strat, 'cadru');

// Pernă (tapițerie) între a și b, grosime g.
const perna = (pic, a, b, g = 6, strat = 'fund', parte = 0) => banda(pic, a, b, g, { parte, strat, raza: Math.min(2.8, g / 2) });

module.exports = { banda, tija, disc, haltera, halteraFrontala, gantera, banca, bancaReglabila, scripete, manerScripete, baraFixaLaterala, baraFixaFrontala, saltea, cutie, stalp, perna };
