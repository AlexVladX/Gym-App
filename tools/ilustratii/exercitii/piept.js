// Piept: împinsuri (bară, gantere, aparat, Smith), flotări, fluturări, pullover.
'use strict';
const S = require('../scena');
const { E, L, F, add, sub, mul, lerp } = S;
const { dreapta, arc, sageata } = require('../compune');

const SOL_PLAT = 12.9 + 6.5 + 45;

// ---------- culcat pe bancă plată ----------
function culcatPlat(A, D) {
  return L({ bazin: 180, piept: 180, cap: 184,
    A: { glezna: S.talpaPe(40, SOL_PLAT), laba: 4, ...A },
    D: { glezna: S.talpaPe(37, SOL_PLAT), laba: 2, ...(D || {}) } });
}
const UMAR_PLAT = [-48.7, 1.5];

function impinsPlat({ unealta = 'bara', priza = 'normala' } = {}) {
  const sus = add(UMAR_PLAT, [3, -57]);
  const jos = priza === 'ingusta' ? add(UMAR_PLAT, [11, -22]) : add(UMAR_PLAT, [7, -24]);
  const bratJos = priza === 'ingusta' ? { bratScara: 0.9, cot: -1 } : { bratScara: 0.42 };
  const echip = (r, pic, corp) => [
    S.bancaPlata(pic, corp, SOL_PLAT),
    unealta === 'bara' ? E.haltera(pic, r.aproape.prindere, 'fund') : null,
    unealta === 'gantere' ? [E.gantera(pic, r.departe.prindere, null, 'spate'), E.gantera(pic, r.aproape.prindere, null, 'sus')] : null,
  ];
  return {
    poze: [
      { corp: culcatPlat({ mana: sus }), echip, sol: SOL_PLAT },
      { corp: culcatPlat({ mana: jos, ...bratJos }), echip, sol: SOL_PLAT,
        sageata: (r, r0) => dreapta(add(r0.aproape.prindere, [0, 6]), add(r.aproape.prindere, [0, -6]), -30) },
    ],
  };
}

// ---------- bancă înclinată ----------
const INCLINARE = 34;
function culcatInclinat(A, D, unghiBanca = INCLINARE) {
  const t = 180 + unghiBanca;
  return L({ bazin: t, piept: t, cap: t + 4,
    A: { glezna: [40, 58], laba: 4, ...A },
    D: { glezna: [37, 58], laba: 2, ...(D || {}) } });
}
function umarInclinat(unghiBanca = INCLINARE) { return L({ bazin: 180 + unghiBanca, piept: 180 + unghiBanca, A: { brat: 90, antebrat: 90 } }).umar; }

function impinsInclinat({ unealta = 'bara', smith = false } = {}) {
  const U = umarInclinat();
  const sus = add(U, [10, -56]);
  const jos = add(U, [12, -21]);
  const echip = (r, pic, corp) => [
    S.bancaInclinata(pic, corp, 65),
    unealta === 'bara' ? E.haltera(pic, r.aproape.prindere, 'fund', smith ? 15 : 20) : null,
    unealta === 'gantere' ? [E.gantera(pic, r.departe.prindere, null, 'spate'), E.gantera(pic, r.aproape.prindere, null, 'sus')] : null,
    smith ? smithCadru(pic, r.aproape.prindere[0], -95, 65) : null,
  ];
  return {
    poze: [
      { corp: culcatInclinat({ mana: sus }), echip, sol: 65 },
      { corp: culcatInclinat({ mana: jos, bratScara: 0.45 }), echip, sol: 65,
        sageata: (r, r0) => dreapta(add(r0.aproape.prindere, [0, 6]), add(r.aproape.prindere, [0, -6]), -30) },
    ],
  };
}

// Cadru Smith: două șine verticale (văzute din lateral se suprapun) cu bara ghidată.
function smithCadru(pic, x, sus, sol) {
  return [
    E.stalp(pic, [x - 4, sus], [x - 4, sol], 3.2, 'fund'),
    E.stalp(pic, [x + 30, sus], [x + 30, sol], 4.4, 'fund'),
    E.stalp(pic, [x - 8, sus], [x + 34, sus], 4.4, 'fund'),
    E.stalp(pic, [x - 14, sol - 1.6], [x + 40, sol - 1.6], 3, 'fund'),
  ];
}

// ---------- bancă declinată ----------
function impinsDeclinat() {
  const t = 180 - 16;
  const corpCu = A => L({ bazin: t, piept: t, cap: t + 3,
    A: { coapsa: -12, gamba: 62, laba: 70, ...A }, D: { coapsa: -10, gamba: 64, laba: 72 } });
  const U = corpCu({ brat: 90, antebrat: 90 }).umar;
  const sus = add(U, [-6, -57]);
  const jos = add(U, [3, -22]);
  const sol = 70;
  const echip = (r, pic, corp) => {
    const a = corp.piept.p(1.35, -11.6), b = corp.bazin.p(-0.3, -13.2);
    const c = add(b, [24, -12]);
    return [
      E.banda(pic, a, b, 6.5, { parte: 1, raza: 2.6 }),
      E.banda(pic, b, c, 6.5, { parte: 1, raza: 2.6 }),
      // pernele pentru glezne
      E.perna(pic, add(r.aproape.gambaFata, [4, 5]), add(r.aproape.gambaFata, [4, 5]), 7),
      { strat: 'fund', svg: `<circle cx="${r.aproape.gambaFata[0] + 5}" cy="${r.aproape.gambaFata[1] + 2}" r="4.2" fill="${pic.lumina(r.aproape.gambaFata, 4, 'tapiterie')}" stroke="rgba(205,212,220,0.55)" stroke-width="0.6"/>`, puncte: [] },
      E.tija(pic, lerp(a, b, 0.3), [lerp(a, b, 0.3)[0], sol], 3.4, 'fund', 'cadru'),
      E.tija(pic, add(c, [0, 6]), [c[0], sol], 3.4, 'fund', 'cadru'),
      E.tija(pic, [lerp(a, b, 0.3)[0] - 8, sol - 1.4], [c[0] + 8, sol - 1.4], 2.6, 'fund', 'cadru'),
      E.haltera(pic, r.aproape.prindere, 'fund'),
    ];
  };
  return {
    poze: [
      { corp: corpCu({ mana: sus }), echip, sol },
      { corp: corpCu({ mana: jos, bratScara: 0.42 }), echip, sol,
        sageata: (r, r0) => dreapta(add(r0.aproape.prindere, [0, 6]), add(r.aproape.prindere, [0, -6]), -30) },
    ],
  };
}

// ---------- flotări ----------
// Corpul spre dreapta, pieptul în jos, tălpile pe sol (sau pe bancă). inc: unghiul corpului (negativ = umerii mai sus).
function flotari({ picioareSus = false, ingust = false } = {}) {
  // înclinațiile alese astfel încât mâinile să ajungă pe sol: sus brațele întinse, jos pieptul aproape de sol
  const [incSus, incJos] = picioareSus ? [-3, 11] : [-22, -7];
  // la picioarele ridicate, solul real e sub mâini; tălpile stau pe o bancă de 45
  const pozitie = (inc, jos) => {
    const leg = 180 + inc;
    const baza = { bazin: inc, piept: inc, cap: inc - 4 };
    const proba = L({ ...baza, A: { brat: 90, antebrat: 90, coapsa: leg, gamba: leg, laba: leg - 95 } });
    const varf = proba.membre.aproape.laba.p(0.96, 4.5);
    const solTalpi = varf[1] + 0.6;
    const sol = picioareSus ? solTalpi + 45 : solTalpi;
    const U = proba.umar;
    const mana = [U[0] + (ingust ? 4 : 3), sol - 3.6];
    const brat = jos ? (ingust ? { cot: 1, bratScara: 0.95 } : { cot: 1, bratScara: 0.62 }) : { cot: 1 };
    const corp = L({ ...baza,
      A: { mana, palma: 'deschisa', ...brat, coapsa: leg, gamba: leg, laba: leg - 95 },
      D: { mana: add(mana, [-2, 0]), coapsa: leg + 1.2, gamba: leg + 1.2, laba: leg - 94 } });
    const G = require('../geom');
    for (const parte of ['aproape', 'departe']) {
      const m = corp.membre[parte];
      m.mana = G.cadru(m.antebrat.p(1, 0), -2, 9.5);
    }
    return { corp, sol, solTalpi };
  };
  const p1 = pozitie(incSus, false), p2 = pozitie(incJos, true);
  const echip = sol => (r, pic, corp) => {
    if (!picioareSus) return [];
    const varf = corp.membre.aproape.laba.p(0.9, 4.5);
    const yBox = varf[1] + 1;
    return [E.banca(pic, [varf[0] - 24, yBox], [varf[0] + 12, yBox], sol)];
  };
  return {
    poze: [
      { corp: p1.corp, echip: echip(p1.sol), sol: p1.sol },
      { corp: p2.corp, echip: echip(p2.sol), sol: p2.sol,
        sageata: (r) => dreapta(add(r.claviculaFata, [12, -40]), add(r.claviculaFata, [12, -6]), 0) },
    ],
  };
}

// ---------- fluturări ----------
// Așezat, văzut din față: coapsele vin spre privitor (scurtate).
const SEZUT_FATA = { coapsa: 96, coapsaScara: 0.2, gamba: 91, laba: 92 };
// Culcat pe bancă, văzut de sus (capul în sus): brațele se deschid lateral și se închid deasupra pieptului.
function fluturePlat() {
  const P = require('./piept')._ajutor;
  const U = P.UMAR_PLAT;
  const echip = (r, pic, corp) => [S.bancaPlata(pic, corp, P.SOL_PLAT), E.gantera(pic, r.departe.prindere, null, 'spate'), E.gantera(pic, r.aproape.prindere, null, 'sus')];
  return {
    poze: [
      { corp: P.culcatPlat({ mana: add(U, [4, 8]), bratScara: 0.5, antebratScara: 0.8, cot: 1 }), echip, sol: P.SOL_PLAT },
      { corp: P.culcatPlat({ mana: add(U, [4, -54]), cot: 1 }), echip, sol: P.SOL_PLAT,
        sageata: () => arc(add(U, [4, -6]), 50, 112, 22) },
    ],
  };
}

function flutureInclinat() {
  const P = require('./piept')._ajutor;
  const U = P.umarInclinat();
  const echip = (r, pic, corp) => [S.bancaInclinata(pic, corp, 65), E.gantera(pic, r.departe.prindere, null, 'spate'), E.gantera(pic, r.aproape.prindere, null, 'sus')];
  return {
    poze: [
      { corp: P.culcatInclinat({ mana: add(U, [3, 10]), bratScara: 0.5, antebratScara: 0.8, cot: 1 }), echip, sol: 65 },
      { corp: P.culcatInclinat({ mana: add(U, [10, -52]), cot: 1 }), echip, sol: 65,
        sageata: (r, r0) => arc(add(U, [6, -8]), 50, 108, 20) },
    ],
  };
}

// Scripete în picioare, văzut din față: crossover (de sus) sau de jos.
function crossover(deSus) {
  const picioare = { coapsa: 97, gamba: 90, laba: 96 };
  const yRola = deSus ? -112 : 82;
  const sol = 92.6;
  const echip = (r, pic) => [
    E.scripete(pic, { x: -86, yRola, mana: r.st.prindere, sol, sus: -124, partea: -1 }),
    E.scripete(pic, { x: 86, yRola, mana: r.dr.prindere, sol, sus: -124, partea: 1 }),
  ];
  const start = deSus ? F({ vedere: 'fata', st: { mana: [-62, -78], cot: -1, ...picioare } })
    : F({ vedere: 'fata', st: { mana: [-50, 14], cot: 1, ...picioare } });
  const final = deSus ? F({ vedere: 'fata', st: { mana: [-4, -12], cot: -1, ...picioare } })
    : F({ vedere: 'fata', st: { mana: [-5, -46], cot: 1, bratScara: 0.75, ...picioare } });
  return {
    poze: [
      { corp: start, echip, sol },
      { corp: final, echip, sol, sageata: (r, r0) => sageata([add(r0.st.prindere, [8, deSus ? 10 : -8]), add(lerp(r0.st.prindere, r.st.prindere, 0.5), [deSus ? 6 : -6, deSus ? 6 : -6]), add(r.st.prindere, [-7, 0])], { dubla: true }) },
    ],
  };
}

// Pec deck: așezat, văzut din față; antebrațele pe perne, brațele se închid în față.
function pecDeck() {
  const sezut = SEZUT_FATA;
  const sol = 58;
  const echip = (r, pic, corp) => {
    const T = corp.trunchi;
    const out = [
      E.banda(pic, T.p(0.05, 0), T.p(1.18, 0), 30, { strat: 'fund', raza: 4 }),
      E.banda(pic, add(T.p(-0.12, 0), [-22, 0]), add(T.p(-0.12, 0), [22, 0]), 10, { strat: 'mijloc', raza: 3 }),
      E.stalp(pic, [0, 4], [0, sol], 5, 'fund'),
      E.stalp(pic, [-30, sol - 1.6], [30, sol - 1.6], 3, 'fund'),
      E.stalp(pic, [-50, -96], [50, -96], 4.4, 'fund'),
    ];
    for (const p of ['st', 'dr']) {
      const c = r[p].cot, m = r[p].prindere;
      out.push(E.perna(pic, add(c, [0, 3]), add(m, [0, -2]), 8, 'fata'));
      out.push(E.tija(pic, add(m, [0, -6]), [m[0] * 0.6, -96], 2.4, 'fund'));
    }
    return out;
  };
  const deschis = F({ vedere: 'fata', st: { brat: 182, antebrat: -88, ...sezut } });
  const inchis = F({ vedere: 'fata', st: { brat: 60, bratScara: 0.42, antebrat: -86, ...sezut } });
  return {
    poze: [
      { corp: deschis, echip, sol },
      { corp: inchis, echip, sol, sageata: (r, r0) => dreapta(add(r0.st.cot, [6, -10]), add(r.st.cot, [-8, -10]), 0) + dreapta(add(r0.dr.cot, [-6, -10]), add(r.dr.cot, [8, -10]), 0) },
    ],
  };
}

// Împins la aparat, așezat (lateral): mânerele de la piept spre înainte.
function impinsAparat() {
  const sezut = { coapsa: 4, gamba: 88, laba: 0 };
  const corpCu = A => L({ bazin: -96, piept: -92, cap: -88, A: { ...sezut, ...A }, D: { coapsa: 6, gamba: 90, laba: 0 } });
  const U = corpCu({ brat: 90, antebrat: 90 }).umar;
  const sol = 13 + 7 + 44;
  const echip = (r, pic, corp) => {
    const piv = [U[0] + 6, U[1] - 52];
    return [
      S.scaun(pic, corp, sol, { spatarSus: 1.12 }),
      E.stalp(pic, [U[0] - 22, -100], [U[0] - 22, sol], 5, 'fund'),
      E.stalp(pic, [U[0] - 26, -100], piv, 4, 'fund'),
      E.tija(pic, piv, r.aproape.prindere, 3, 'mijloc', 'cadru'),
      E.disc(pic, add(piv, [6, -4]), 9, 'fund', 1),
      E.gantera(pic, r.aproape.prindere, 90, 'sus', 1.6),
    ];
  };
  return {
    poze: [
      { corp: corpCu({ mana: add(U, [16, 4]), cot: 1 }), echip, sol },
      { corp: corpCu({ mana: add(U, [56, 4]), cot: 1 }), echip, sol,
        sageata: (r, r0) => dreapta(add(r0.aproape.prindere, [6, -14]), add(r.aproape.prindere, [-2, -14]), 0) },
    ],
  };
}

// Pullover cu gantera, culcat pe bancă plată.
function pullover() {
  const P = require('./piept')._ajutor;
  const U = P.UMAR_PLAT;
  const echip = (r, pic, corp) => [S.bancaPlata(pic, corp, P.SOL_PLAT), E.gantera(pic, add(r.aproape.prindere, mul(require('../geom').dir(corp.membre.aproape.antebrat.unghi), 7)), corp.membre.aproape.antebrat.unghi, 'sus', 5.8)];
  return {
    poze: [
      { corp: P.culcatPlat({ mana: add(U, [-52, -4]), cot: 1 }, { mana: add(U, [-54, -5]) }), echip, sol: P.SOL_PLAT },
      { corp: P.culcatPlat({ mana: add(U, [2, -55]), cot: 1 }), echip, sol: P.SOL_PLAT,
        sageata: (r, r0) => arc(U, 66, 196, 262) },
    ],
  };
}

const { dir } = require('../geom');
module.exports = {
  'Împins cu bara pe bancă': () => impinsPlat({ unealta: 'bara' }),
  'Împins cu gantere pe bancă': () => impinsPlat({ unealta: 'gantere' }),
  'Împins cu bara pe bancă înclinată': () => impinsInclinat({ unealta: 'bara' }),
  'Împins cu gantere pe bancă înclinată': () => impinsInclinat({ unealta: 'gantere' }),
  'Împins înclinat la aparatul Smith': () => impinsInclinat({ unealta: 'bara', smith: true }),
  'Împins cu bara pe bancă declinată': () => impinsDeclinat(),
  'Flotări': () => flotari({}),
  'Flotări cu picioarele ridicate': () => flotari({ picioareSus: true }),
  'Fluturări cu gantere': () => fluturePlat(),
  'Fluturări cu gantere pe bancă înclinată': () => flutureInclinat(),
  'Fluturări la scripete (crossover)': () => crossover(true),
  'Fluturări la scripete de jos': () => crossover(false),
  'Fluturări la aparat (pec deck)': () => pecDeck(),
  'Împins la aparat pentru piept': () => impinsAparat(),
  'Pullover cu gantera': () => pullover(),
  _ajutor: { SEZUT_FATA, culcatPlat, impinsPlat, SOL_PLAT, UMAR_PLAT, culcatInclinat, umarInclinat, flotari, smithCadru },
};
