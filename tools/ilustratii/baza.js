// Ajutoare pentru descrierea pozițiilor: cinematică inversă (mâna/glezna la un punct dat),
// valori implicite pentru membrele din spate și scurtături pentru echipament.
'use strict';
const Corp = require('./corp');
const { add, sub, dist, mul } = require('./geom');
const { LUNG, LUNG_F } = Corp;

const grade = r => r * 180 / Math.PI;

// Două segmente (L1, L2) de la S la ținta T; semn alege de ce parte se îndoaie articulația.
function ik(S, T, L1, L2, semn = 1) {
  const d = Math.max(Math.abs(L1 - L2) + 0.01, Math.min(dist(S, T), (L1 + L2) * 0.9995));
  const a = Math.atan2(T[1] - S[1], T[0] - S[0]);
  const c = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))));
  const a1 = a + semn * c;
  const E = [S[0] + L1 * Math.cos(a1), S[1] + L1 * Math.sin(a1)];
  const a2 = Math.atan2(T[1] - E[1], T[0] - E[0]);
  return [grade(a1), grade(a2)];
}

// Completează un membru: dacă are „mana" (ținta prinderii), calculează brațul; dacă are „glezna", piciorul.
function rezolvaMembru(m, umar, sold, lung) {
  const r = { ...m };
  if (m.mana && Array.isArray(m.mana)) {
    const L1 = lung.brat * (m.bratScara || 1), L2 = lung.antebrat * (m.antebratScara || 1) + lung.mana * 0.5;
    [r.brat, r.antebrat] = ik(umar, m.mana, L1, L2, m.cot ?? 1);
    r.mana = m.manaUnghi || 0;
  } else {
    r.mana = m.manaUnghi || 0;
  }
  if (m.glezna) {
    const L1 = lung.coapsa * (m.coapsaScara || 1), L2 = lung.gamba * (m.gambaScara || 1);
    [r.coapsa, r.gamba] = ik(sold, m.glezna, L1, L2, m.genunchi ?? -1);
  }
  return r;
}

// Poziție laterală. s = { bazin, piept, cap, A: membrul apropiat, D: membrul îndepărtat (implicit ≈ A) }
// Membru: { mana: [x,y] | brat+antebrat, cot, glezna: [x,y] | coapsa+gamba, genunchi, laba, palma, manaUnghi, ... }
function L(s) {
  const bazin = s.bazin ?? -90, piept = s.piept ?? bazin;
  const schelet = Corp.lateral({ bazin, piept, cap: s.cap ?? piept + 2,
    aproape: { brat: 90, antebrat: 90, coapsa: 90, gamba: 90 }, departe: { brat: 90, antebrat: 90, coapsa: 90, gamba: 90 } });
  const umar = schelet.umar;
  const A = s.A || {};
  const Dbaza = { ...A };
  // membrul din spate: aceeași mișcare, puțin decalată (se vede ca a doua mână / al doilea picior)
  if (Array.isArray(A.mana)) Dbaza.mana = add(A.mana, [-2.2, -0.8]);
  if (A.brat !== undefined) { Dbaza.brat = A.brat - 3; Dbaza.antebrat = A.antebrat - 3; }
  if (Array.isArray(A.glezna)) Dbaza.glezna = add(A.glezna, [-2.5, 0]);
  if (A.coapsa !== undefined && !A.glezna) { Dbaza.coapsa = A.coapsa + 2; Dbaza.gamba = A.gamba; }
  const D = { ...Dbaza, ...(s.D || {}) };
  if (s.D && s.D.brat !== undefined && !s.D.mana) delete D.mana;
  if (s.D && s.D.coapsa !== undefined && !s.D.glezna) delete D.glezna;
  const u = {
    bazin, piept, cap: s.cap ?? piept + 2,
    aproape: rezolvaMembru(A, umar, [0, 0], LUNG),
    departe: rezolvaMembru(D, umar, [0, 0], LUNG),
  };
  return Corp.lateral(u);
}

// Poziție frontală. s = { vedere, trunchi, st, dr } ; dr implicit = oglinda lui st.
function F(s) {
  const T = s.trunchi ?? -90;
  const schelet = Corp.frontal({ vedere: s.vedere, trunchi: T, trunchiScara: s.trunchiScara, ridicare: s.ridicare,
    st: { brat: 90, antebrat: 90, coapsa: 90, gamba: 90 }, dr: { brat: 90, antebrat: 90, coapsa: 90, gamba: 90 } });
  const oglinda = m => {
    const o = { ...m };
    for (const k of ['brat', 'antebrat', 'coapsa', 'gamba', 'laba']) if (m[k] !== undefined) o[k] = 180 - m[k];
    if (Array.isArray(m.mana)) o.mana = [-m.mana[0], m.mana[1]];
    if (Array.isArray(m.glezna)) o.glezna = [-m.glezna[0], m.glezna[1]];
    if (m.cot !== undefined) o.cot = -m.cot;
    if (m.genunchi !== undefined) o.genunchi = -m.genunchi;
    if (m.manaUnghi !== undefined) o.manaUnghi = -m.manaUnghi;
    return o;
  };
  const st = s.st || {};
  const dr = s.dr ? { ...oglinda(st), ...s.dr } : oglinda(st);
  if (s.dr && s.dr.brat !== undefined && !s.dr.mana) delete dr.mana;
  if (s.dr && s.dr.coapsa !== undefined && !s.dr.glezna) delete dr.glezna;
  const m = schelet.membre;
  const u = {
    vedere: s.vedere, trunchi: T, trunchiScara: s.trunchiScara, ridicare: s.ridicare, cap: s.cap, capScara: s.capScara, gat: s.gat,
    st: rezolvaMembru({ cot: -1, genunchi: 1, ...st }, m.st.brat.o, m.st.coapsa.o, LUNG_F),
    dr: rezolvaMembru({ cot: 1, genunchi: -1, ...dr }, m.dr.brat.o, m.dr.coapsa.o, LUNG_F),
  };
  return Corp.frontal(u);
}

// Picioare drepte, în picioare (laterală): glezna sub șold.
const PICIOARE = { coapsa: 90, gamba: 90, laba: 0 };
const PICIOARE_D = { coapsa: 92, gamba: 90, laba: 0 };

module.exports = { ik, L, F, PICIOARE, PICIOARE_D, add, sub, mul, dist };
