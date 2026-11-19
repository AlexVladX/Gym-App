// Spate: tracțiuni, helcometru, ramat, îndreptări, ridicări din umeri, hiperextensii.
'use strict';
const S = require('../scena');
const { E, L, F, add, sub, mul, lerp } = S;
const { dreapta, arc, sageata } = require('../compune');
const K = require('./comun');
const Corp = require('../corp');
const { dir } = require('../geom');

// ---------- tracțiuni ----------
function tractiuni(supinat) {
  const vedere = supinat ? 'fata' : 'spate';
  const x = supinat ? 17 : 38;
  const picioare = { coapsa: 93, gamba: 96, laba: 98, labaScara: 1.1 };
  const jos = F({ vedere, st: { mana: [-x, -104], cot: -1, ...picioare } });
  const sus = supinat
    ? F({ vedere, st: { brat: 96, bratScara: 0.5, antebrat: -93, ...picioare } })
    : F({ vedere, st: { mana: [-x, -64], cot: -1, ...picioare } });
  const echip = (r, pic) => E.baraFixaFrontala(pic, r.st.prindere[1] - 0.5, -64, 64, supinat ? 'fund' : 'sus');
  return {
    poze: [
      { corp: jos, echip, sol: null, ancora: jos.membre.st.mana.p(0.5, 0)[1] },
      { corp: sus, echip, sol: null, ancora: sus.membre.st.mana.p(0.5, 0)[1],
        sageata: (r) => dreapta(add(r.capVarf, [30, 46]), add(r.capVarf, [30, 4]), 0) },
    ],
  };
}

// ---------- helcometru ----------
function helcometruLat() {
  // văzut din spate, așezat, genunchii sub pernă
  const jos = K.sezutF({ mana: [-42, -104], cot: -1 }, { vedere: 'spate' });
  const sus = K.sezutF({ mana: [-40, -58], cot: -1 }, { vedere: 'spate' });
  const sol = 58;
  const echip = (r, pic) => {
    const a = r.st.prindere, b = r.dr.prindere;
    const ys = Math.min(a[1], b[1]);
    return [
      E.banda(pic, [-20, 14], [20, 14], 9, { strat: 'mijloc', raza: 3 }),
      E.stalp(pic, [0, 18], [0, sol], 5, 'fund'), E.stalp(pic, [-26, sol - 1.6], [26, sol - 1.6], 3, 'fund'),
      E.banda(pic, [-26, -2], [26, -2], 7, { strat: 'fund', raza: 3.5 }),
      { strat: 'fund', svg: `<path d="M0,${ys - 4}L0,-150" stroke="#BFC6CE" stroke-width="0.9"/>`, puncte: [[0, -150]] },
      E.tija(pic, add(a, [-10, 4]), add(a, [2, -1]), 2.4, 'fund'), E.tija(pic, add(b, [10, 4]), add(b, [-2, -1]), 2.4, 'fund'),
      E.tija(pic, add(a, [2, -1]), add(b, [-2, -1]), 2.4, 'fund'),
    ];
  };
  return {
    poze: [
      { corp: jos, echip, sol },
      { corp: sus, echip, sol, sageata: (r) => dreapta(add(r.capVarf, [28, 2]), add(r.capVarf, [28, 46]), 0) },
    ],
  };
}

function helcometruLateral(maner) {
  const trunchi = { bazin: -94, piept: -100, cap: -92 };
  const U = K.umar(trunchi);
  const corp = A => K.sezut({ ...A }, {}, trunchi);
  const sol = K.SOL_SEZUT;
  const xCablu = U[0] + 10;
  const echip = (r, pic, c) => [
    S.scaun(pic, c, sol, { spatar: false, sezutLung: 30 }),
    { strat: 'fund', svg: `<circle cx="${r.aproape.genunchi[0] - 2}" cy="${r.aproape.genunchi[1] - 11}" r="4.6" fill="${pic.lumina(r.aproape.genunchi, 4, 'tapiterie')}" stroke="rgba(205,212,220,0.55)" stroke-width="0.6"/>`, puncte: [] },
    { strat: 'spate', svg: `<path d="M${xCablu},-150L${r.aproape.prindere[0].toFixed(1)},${(r.aproape.prindere[1] - 3).toFixed(1)}" stroke="#BFC6CE" stroke-width="0.9"/>`, puncte: [[xCablu, -150]] },
    E.stalp(pic, [U[0] - 40, -156], [U[0] - 40, sol], 5, 'fund'), E.stalp(pic, [U[0] - 44, -152], [xCablu + 4, -152], 4, 'fund'),
    E.manerScripete(pic, maner, r.aproape.prindere, maner === 'v' ? 90 : -90),
  ];
  return {
    poze: [
      { corp: corp({ mana: add(U, [10, -55]), cot: 1 }), echip, sol },
      { corp: corp({ mana: add(U, [15, 2]), cot: 1 }), echip, sol,
        sageata: (r, r0) => dreapta(add(r0.aproape.prindere, [14, 8]), add(r.aproape.prindere, [14, -8]), 0) },
    ],
  };
}

// Pulldown cu brațele întinse (în picioare, ușor aplecat).
function pulldownBrateIntinse() {
  const t = -74;
  const U = K.umar({ bazin: t, piept: t + 2 });
  const tower = U[0] + 64;
  const corp = a => K.aplecat(t, { mana: add(U, mul(dir(a), 57)), cot: -1 });
  const echip = (r, pic, c) => {
    const sol = c.membre.aproape.laba.p(0.3, 6.8)[1];
    return E.scripete(pic, { x: tower, yRola: -120, mana: r.aproape.prindere, sol, sus: -132, maner: 'bara', partea: 1 });
  };
  return {
    poze: [
      { corp: corp(-28), echip },
      { corp: corp(76), echip, sageata: () => arc(U, 64, -24, 66) },
    ],
  };
}

// Ramat la scripete, așezat.
function ramatScripete() {
  const sol = 13 + 7 + 26;
  const corp = (t, A) => L({ bazin: t, piept: t - 2, cap: t + 2,
    A: { glezna: [74, sol - 30], genunchi: -1, laba: -70, ...A }, D: { glezna: [71, sol - 30], laba: -70 } });
  const U0 = K.umar({ bazin: -72, piept: -74 });
  const U1 = K.umar({ bazin: -92, piept: -94 });
  const echip = (r, pic, c) => {
    const yTop = c.bazin.p(-0.3, -13)[1] + 0.3;
    const placa = add(r.aproape.talpa, [5, -4]);
    return [
      E.banca(pic, [-24, yTop], [56, yTop], sol),
      E.perna(pic, add(placa, [-4, 12]), add(placa, [6, -16]), 4, 'fund'),
      E.scripete(pic, { x: placa[0] + 16, yRola: placa[1] - 8, mana: r.aproape.prindere, sol, sus: -60, maner: 'v', partea: 1, stiva: false }),
    ];
  };
  return {
    poze: [
      { corp: corp(-72, { mana: add(U0, [56, 10]), cot: -1 }), echip, sol },
      { corp: corp(-92, { mana: add(U1, [16, 32]), cot: -1 }), echip, sol,
        sageata: (r, r0) => dreapta(add(r0.aproape.prindere, [0, -12]), add(r.aproape.prindere, [6, -12]), 0) },
    ],
  };
}

// Ramat la aparat (piept sprijinit pe pernă).
function ramatAparat() {
  const trunchi = { bazin: -88, piept: -86, cap: -86 };
  const U = K.umar(trunchi);
  const sol = K.SOL_SEZUT;
  const echip = (r, pic, c) => {
    const pf = c.piept.p(0.6, 15.5);
    const piv = [U[0] + 60, sol - 12];
    return [
      S.scaun(pic, c, sol, { spatar: false, sezutLung: 30 }),
      E.perna(pic, add(pf, [3, -16]), add(pf, [3, 12]), 7, 'sus'),
      E.stalp(pic, add(pf, [6, 0]), [pf[0] + 22, pf[1]], 4, 'fund'),
      E.stalp(pic, [pf[0] + 22, -70], [pf[0] + 22, sol], 5, 'fund'),
      E.tija(pic, r.aproape.prindere, piv, 3, 'spate', 'cadru'),
      E.disc(pic, piv, 6, 'fund', 0),
      E.gantera(pic, r.aproape.prindere, 90, 'sus', 1.7),
    ];
  };
  return {
    poze: [
      { corp: K.sezut({ mana: add(U, [50, 14]), cot: -1 }, {}, trunchi), echip, sol },
      { corp: K.sezut({ mana: add(U, [16, 26]), cot: -1 }, {}, trunchi), echip, sol,
        sageata: (r, r0) => dreapta(add(r0.aproape.prindere, [-2, -12]), add(r.aproape.prindere, [4, -12]), 0) },
    ],
  };
}

// Ramat aplecat: bară, două gantere, T-bar.
function ramatAplecat(unealta) {
  const t = unealta === 'tbar' ? -36 : -32;
  const proba = K.aplecat(t);
  const U = proba.umar;
  const tinta = proba.piept.p(0.32, 16);
  const corp = A => K.aplecat(t, { cot: 1, ...A });
  const echip = (r, pic, c) => {
    const sol = c.membre.aproape.laba.p(0.3, 6.8)[1];
    const m = r.aproape.prindere;
    if (unealta === 'bara') return [E.haltera(pic, m, 'fund')];
    if (unealta === 'gantere') return [E.gantera(pic, r.departe.prindere, null, 'spate'), E.gantera(pic, m, null, 'sus')];
    // T-bar: bara pornește de pe sol din spate și trece printre picioare; discurile la capătul din față
    const piv = [-46, sol - 3];
    const capat = add(m, mul(dir(Math.atan2(m[1] - piv[1], m[0] - piv[0]) * 180 / Math.PI), 10));
    return [
      E.tija(pic, piv, capat, 2.6, 'spate'),
      E.disc(pic, capat, 14, 'spate', 1),
      E.tija(pic, add(m, [0, -4]), add(m, [0, 4]), 2.2, 'fata'),
      E.disc(pic, piv, 2.4, 'fund', 0),
    ];
  };
  return {
    poze: [
      { corp: corp({ mana: add(U, [3, 56]) }), echip },
      { corp: corp({ mana: add(tinta, [-2, 4]) }), echip,
        sageata: (r, r0) => dreapta(add(r0.aproape.prindere, [18, -2]), add(r.aproape.prindere, [18, 0]), 0) },
    ],
  };
}

// Ramat cu gantera, un genunchi și o mână pe bancă.
function ramatGantera() {
  const t = -6;
  const banc = 49.4, sol = banc + 45;
  const baza = { bazin: t, piept: t + 1, cap: t + 12 };
  const U = K.umar(baza);
  const corp = A => L({ ...baza,
    A: { glezna: [-16, sol - 7.3], laba: 0, cot: 1, ...A },
    D: { coapsa: 92, gamba: 180, laba: 120, mana: [U[0] + 3, banc - 3.6], palma: 'deschisa' } });
  const tinta = L({ ...baza, A: { brat: 90, antebrat: 90 } }).piept.p(0.42, 16);
  const echip = (r, pic, c) => [E.banca(pic, [-46, banc], [U[0] + 18, banc], sol), E.gantera(pic, r.aproape.prindere, null, 'sus')];
  const ajustaMana = c => { const m = c.membre.departe; m.mana = require('../geom').cadru(m.antebrat.p(1, 0), 0, 9.5); return c; };
  return {
    poze: [
      { corp: ajustaMana(corp({ mana: add(U, [4, 54]) })), echip, sol },
      { corp: ajustaMana(corp({ mana: add(tinta, [-4, 6]) })), echip, sol,
        sageata: (r, r0) => dreapta(add(r0.aproape.prindere, [16, 0]), add(r.aproape.prindere, [16, 0]), 0) },
    ],
  };
}

// Ramat cu pieptul pe bancă înclinată.
function ramatPieptBanca() {
  const t = -42;
  const baza = { bazin: t, piept: t, cap: t + 8 };
  const U = K.umar(baza);
  const sol = 74;
  const corp = A => L({ ...baza, A: { glezna: [-14, sol - 7.3], cot: 1, laba: 0, ...A }, D: { glezna: [-17, sol - 7.3], laba: 0 } });
  const echip = (r, pic, c) => {
    const a = c.bazin.p(0.1, 10.4), b = c.piept.p(0.98, 11.5);
    return [
      E.banda(pic, a, b, 6.5, { parte: 1, raza: 2.6, strat: 'mijloc' }),
      E.tija(pic, lerp(a, b, 0.5), [lerp(a, b, 0.5)[0] + 6, sol], 3.4, 'fund', 'cadru'),
      E.tija(pic, add(a, [2, 6]), [a[0] - 6, sol], 3.4, 'fund', 'cadru'),
      E.tija(pic, [a[0] - 12, sol - 1.4], [lerp(a, b, 0.5)[0] + 14, sol - 1.4], 2.6, 'fund', 'cadru'),
      E.gantera(pic, r.departe.prindere, null, 'spate'), E.gantera(pic, r.aproape.prindere, null, 'sus'),
    ];
  };
  return {
    poze: [
      { corp: corp({ mana: add(U, [1, 56]) }), echip, sol },
      { corp: corp({ mana: add(U, [-12, 24]) }), echip, sol,
        sageata: (r, r0) => dreapta(add(r0.aproape.prindere, [-14, 0]), add(r.aproape.prindere, [-14, 0]), 0) },
    ],
  };
}

// ---------- îndreptări ----------
function indreptari({ rack = false } = {}) {
  // start: bara pe sol (sau pe suport la genunchi), final: în picioare
  const t = rack ? -52 : -30;
  const g = rack ? [10, 82] : [33, 52];
  const proba = K.aplecat(t, {}, null, { glezna: g });
  const U = proba.umar;
  const tSol = proba.membre.aproape.laba.p(0.3, 6.8)[1];
  const mStart = rack ? add(U, [2, 56]) : [g[0] + 6, tSol - 20];
  const start = K.aplecat(t, { mana: mStart, cot: 1 }, null, { glezna: g });
  const Us = K.umar({ bazin: -90, piept: -90.5 });
  const final = K.sta({ mana: add(Us, [3, 56]) }, { mana: add(Us, [1, 56]) }, { piept: -92 });
  const echip = (r, pic, c) => {
    const out = [E.haltera(pic, r.aproape.prindere, 'fund')];
    if (rack) {
      const sol = c.membre.aproape.laba.p(0.3, 6.8)[1];
      const xr = start.membre.aproape.mana.p(0.5, 0)[0] + 28;
      const yPin = start.membre.aproape.mana.p(0.5, 0)[1] - c.sold[1] + 3;
      void yPin;
      const pin = sol - (tSol - start.membre.aproape.mana.p(0.5, 0)[1] - 21);
      out.unshift(E.stalp(pic, [xr, -60], [xr, sol], 4.4, 'fund'), E.tija(pic, [xr - 40, pin], [xr + 3, pin], 3, 'fund'));
    }
    return out;
  };
  return {
    poze: [
      { corp: start, echip },
      { corp: final, echip, sageata: (r, r0) => dreapta(add(r.aproape.prindere, [34, 50]), add(r.aproape.prindere, [34, 4]), 0) },
    ],
  };
}

// ---------- ridicări din umeri ----------
function ridicariUmeri(unealta) {
  const x = unealta === 'bara' ? 22 : 25;
  const jos = K.staF({ mana: [-x, 7], cot: -1 });
  const sus = K.staF({ mana: [-x, 0], cot: -1 }, { ridicare: 7 });
  const echip = (r, pic) => unealta === 'bara'
    ? E.halteraFrontala(pic, [0, r.st.prindere[1]], { strat: 'fata' })
    : [E.gantera(pic, r.st.prindere, null, 'fata', 6), E.gantera(pic, r.dr.prindere, null, 'fata', 6)];
  return {
    poze: [
      { corp: jos, echip },
      { corp: sus, echip, sageata: (r) => dreapta(add(r.st.umar, [-24, 6]), add(r.st.umar, [-24, -8]), 0) + dreapta(add(r.dr.umar, [24, 6]), add(r.dr.umar, [24, -8]), 0) },
    ],
  };
}

// ---------- hiperextensii (banca romană la 45°) ----------
function hiperextensii() {
  const leg = 138;
  const corp = t => L({ bazin: t, piept: t, cap: t + (t > 0 ? -10 : 4),
    A: { coapsa: leg, gamba: leg, laba: leg - 95, brat: t + 150, antebrat: t - 40 }, D: { coapsa: leg + 1, gamba: leg + 1, laba: leg - 94, brat: t + 146, antebrat: t - 44 } });
  const sus = corp(-42), jos = corp(70);
  const echip = (r, pic, c) => {
    const pad = c.membre.aproape.coapsa.p(0.12, -9.8);
    const role = c.membre.aproape.gamba.p(0.86, 4.2);
    const sol = role[1] + 22;
    return [
      E.perna(pic, add(pad, [-10, 8]), add(pad, [8, -8]), 7, 'sus', 0),
      { strat: 'sus', svg: `<circle cx="${role[0].toFixed(1)}" cy="${(role[1] + 4).toFixed(1)}" r="4.4" fill="${pic.lumina(role, 4, 'tapiterie')}" stroke="rgba(205,212,220,0.55)" stroke-width="0.6"/>`, puncte: [] },
      E.stalp(pic, add(pad, [4, 4]), [pad[0] + 4, sol], 4.4, 'fund'),
      E.stalp(pic, add(role, [2, 6]), [pad[0] + 4, sol - 16], 3.4, 'fund'),
      E.stalp(pic, [role[0] - 12, sol - 1.6], [pad[0] + 18, sol - 1.6], 3, 'fund'),
      { strat: 'fund', svg: '', puncte: [[pad[0], sol]] },
    ];
  };
  const solDe = c => c.membre.aproape.gamba.p(0.86, 4.2)[1] + 22;
  return {
    poze: [
      { corp: jos, echip, sol: solDe(jos) },
      { corp: sus, echip, sol: solDe(sus), sageata: (r) => arc(r.sold, 62, 62, -32) },
    ],
  };
}

module.exports = {
  'Tracțiuni': () => tractiuni(false),
  'Tracțiuni cu priză supinată': () => tractiuni(true),
  'Tracțiuni la helcometru': () => helcometruLat(),
  'Helcometru cu priză îngustă': () => helcometruLateral('bara'),
  'Helcometru cu mâner în V': () => helcometruLateral('v'),
  'Pulldown cu brațele întinse': () => pulldownBrateIntinse(),
  'Ramat la scripete, așezat': () => ramatScripete(),
  'Ramat la aparat': () => ramatAparat(),
  'Ramat cu bara': () => ramatAplecat('bara'),
  'Ramat cu două gantere': () => ramatAplecat('gantere'),
  'Ramat T-bar': () => ramatAplecat('tbar'),
  'Ramat cu gantera': () => ramatGantera(),
  'Ramat cu pieptul pe bancă înclinată': () => ramatPieptBanca(),
  'Îndreptări (deadlift)': () => indreptari({}),
  'Îndreptări parțiale (rack pull)': () => indreptari({ rack: true }),
  'Ridicări din umeri cu bara': () => ridicariUmeri('bara'),
  'Ridicări din umeri cu gantere': () => ridicariUmeri('gantere'),
  'Hiperextensii (extensii lombare)': () => hiperextensii(),
  _ajutor: { indreptari },
};
