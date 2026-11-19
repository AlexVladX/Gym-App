// Corpul anatomic: vedere laterală (profil, privește spre dreapta) și vedere frontală (din față sau din spate).
// Fiecare segment are un profil (lățimi de-a lungul osului) și mușchi definiți relativ la profil:
// punct (t, k) → la fracția t din os, k × lățimea profilului pe acea parte. Astfel mușchii urmăresc silueta.
// Zonele mușchilor sunt aceleași ca în aplicație; un mușchi poate aparține mai multor zone.
'use strict';
const G = require('./geom');
const { cadru, curbaInchisa, curbaDeschisa, latime, add, mul, sub, dist } = G;

// ---------- culori fixe ----------
const C = {
  contur: '#16191D', rim: '#C3CAD3', rimDep: '#737B85',
  definitie: 'rgba(14,16,20,0.4)', definitieFina: 'rgba(14,16,20,0.32)', luciu: 'rgba(255,255,255,0.10)',
  fibra: 'rgba(255,255,255,0.30)', marginePrincipal: 'rgba(20,34,6,0.7)',
};

// ---------- desenarea unui strat ----------
// piesa: { d, cad?, w?, ton, muschi: [{ d, zone, dirFibre, def, pts }], detalii: [{ d, stil }] }
function nivelMuschi(m, niv) {
  let n = 0;
  for (const z of m.zone) n = Math.max(n, niv[z] || 0);
  return n;
}

function fibre(pts, u) {
  const v = [-u[1], u[0]];
  const pu = pts.map(p => p[0] * u[0] + p[1] * u[1]);
  const pv = pts.map(p => p[0] * v[0] + p[1] * v[1]);
  const u0 = Math.min(...pu) - 1, u1 = Math.max(...pu) + 1, v0 = Math.min(...pv), v1 = Math.max(...pv);
  const latimeV = v1 - v0;
  const n = Math.max(2, Math.min(11, Math.round(latimeV / 1.5)));
  const curb = latimeV * 0.07;
  let s = '';
  for (let i = 1; i <= n; i++) {
    const vv = v0 + latimeV * i / (n + 1);
    const pct = (uu, dv) => add(mul(u, uu), mul(v, vv + dv));
    s += curbaDeschisa([pct(u0, curb), pct((u0 + u1) / 2, -curb), pct(u1, curb)]);
  }
  return s;
}

function strat(piese, { pictura, niv, departe = false, lod = 'detaliu' }) {
  const detaliat = lod === 'detaliu';
  let sil = '', corp = '', mus = '', fib = '', def = '', det = '';
  for (const pc of piese) {
    if (!pc) continue;
    const id = pictura.forma(pc.d);
    sil += `<use href="#${id}"/>`;
    const ton = pc.ton === 'piele' && departe ? 'pieleDep' : pc.ton;
    const grad = {};
    const umbra = t => grad[t] || (grad[t] = pc.cad ? pictura.cilindru(pc.cad, pc.w, t) : pictura.lumina(pc.centru || [0, 0], pc.raza || 10, t));
    corp += `<use href="#${id}" fill="${umbra(ton)}"/>`;
    for (const m of pc.muschi || []) {
      const n = nivelMuschi(m, niv);
      if (n) {
        const cheie = (n === 2 ? 'p' : 's') + (departe ? 'd' : '');
        const mid = pictura.forma(m.d);
        mus += `<use href="#${mid}" fill="${umbra(cheie)}"/>`;
        if (detaliat && m.dirFibre) {
          fib += `<path d="${fibre(m.pts, m.dirFibre)}" clip-path="${pictura.decupajUse(mid)}" opacity="${n === 2 ? 1 : 0.55}"/>`;
        }
      } else if (m.def && (detaliat || m.def === 'mereu')) {
        def += `<path d="${m.d}"/>`;
      }
    }
    for (const x of pc.detalii || []) {
      if (!detaliat && !x.mereu) continue;
      det += `<path d="${x.d}"${x.stil}/>`;
    }
  }
  return `<g fill="${C.contur}" stroke="${departe ? C.rimDep : C.rim}" stroke-width="${departe ? 0.9 : 1.25}" stroke-linejoin="round">${sil}</g>`
    + `<g>${corp}</g>`
    + (def ? `<g fill="none" stroke="${C.definitie}" stroke-width="0.36" stroke-linejoin="round">${def}</g>` : '')
    + (mus ? `<g stroke="${C.marginePrincipal}" stroke-width="0.35">${mus}</g>` : '')
    + (fib ? `<g fill="none" stroke="${C.fibra}" stroke-width="0.36">${fib}</g>` : '')
    + det;
}

// ---------- construirea pieselor ----------
// profil: [t, lățime pe −y, lățime pe +y]; oglinda (−1) inversează părțile (pentru membrele din dreapta, vedere frontală)
function piesaSegment(cad, profil, muschi, { ton = 'piele', oglinda = 1 } = {}) {
  const lat = (t, semn) => latime(profil, t, semn * oglinda);
  const neg = profil.map(([t]) => cad.p(t, -lat(t, -1)));
  const poz = profil.map(([t]) => cad.p(t, lat(t, 1))).reverse();
  const w = Math.max(...profil.map(r => Math.max(r[1], r[2])));
  const m = (muschi || []).map(x => {
    const pts = x.pts.map(([t, k]) => cad.p(t, k * lat(t, Math.sign(k) || 1)));
    const fa = (x.fa || 0) * Math.PI / 180;
    // direcția fibrelor: de-a lungul osului, rotită cu fa (în sensul local, ținând cont de oglindire)
    const u = [cad.d[0] * Math.cos(fa) + cad.n[0] * Math.sin(fa) * oglinda, cad.d[1] * Math.cos(fa) + cad.n[1] * Math.sin(fa) * oglinda];
    return { d: curbaInchisa(pts, x.tens ?? 0.5), pts, zone: [].concat(x.zona || []), def: x.def ?? true, dirFibre: x.zona ? u : null };
  });
  return { d: curbaInchisa([...neg, ...poz]), cad, w, ton, muschi: m, puncte: [...neg, ...poz] };
}

// Formă liberă în cadrul unui os (puncte (t, y) absolute).
function forma(cad, pts, tens) { return curbaInchisa(pts.map(([t, y]) => cad.p(t, y)), tens); }
function puncteForma(cad, pts) { return pts.map(([t, y]) => cad.p(t, y)); }

// ======================================================================
//  VEDERE LATERALĂ
// ======================================================================
const LUNG = { bazin: 22, piept: 31, brat: 30, antebrat: 25, coapsa: 44, gamba: 43, laba: 24, mana: 9, cap: 24 };

// −y = fața membrului (biceps, cvadriceps, tibie); la trunchi +y = fața (piept, abdomen).
const PROFIL_L = {
  brat: [[-0.16, 6.4, 7.0], [0.06, 6.8, 7.4], [0.3, 6.6, 7.0], [0.5, 6.3, 6.4], [0.72, 5.2, 5.4], [0.92, 4.4, 4.6], [1.08, 4.0, 4.1]],
  antebrat: [[-0.1, 4.4, 4.4], [0.12, 5.3, 5.0], [0.35, 4.8, 4.5], [0.65, 3.5, 3.3], [0.92, 2.7, 2.6], [1.06, 2.6, 2.5]],
  coapsa: [[-0.14, 8.0, 9.6], [0.08, 9.3, 9.5], [0.3, 9.9, 8.9], [0.55, 9.3, 8.2], [0.8, 7.5, 6.7], [0.97, 6.0, 5.9], [1.08, 5.4, 5.4]],
  gamba: [[-0.08, 5.4, 5.4], [0.12, 5.0, 7.0], [0.28, 4.7, 7.5], [0.45, 4.1, 6.3], [0.68, 3.2, 3.9], [0.9, 2.8, 3.0], [1.04, 2.9, 3.1]],
  bazin: [[-0.36, 7.5, 6.5], [-0.15, 12.9, 8.6], [0.1, 12.5, 9.4], [0.45, 9.7, 9.9], [0.8, 9.1, 10.1], [1.05, 9.7, 10.1]],
  piept: [[-0.05, 9.9, 10.3], [0.3, 11.3, 12.0], [0.55, 12.3, 14.2], [0.75, 12.5, 13.9], [0.9, 10.9, 10.7], [1.0, 7.5, 7.3], [1.08, 4.9, 4.9]],
};

const bloc = (t0, t1, k0, k1) => [[t0 + 0.01, k0], [t0, (k0 + k1) / 2], [t0 + 0.012, k1], [(t0 + t1) / 2, k1 + Math.sign(k1) * 0.03], [t1 - 0.012, k1], [t1, (k0 + k1) / 2], [t1 - 0.01, k0], [(t0 + t1) / 2, k0 - Math.sign(k1) * 0.02]];

const MUSCHI_L = {
  brat: [
    { zona: 'umeri', pts: [[-0.16, -0.5], [-0.02, -1.0], [0.18, -1.02], [0.36, -0.82], [0.45, -0.32], [0.3, -0.14], [0.1, -0.16], [-0.12, -0.2]], fa: 4 },
    { zona: 'umeri', pts: [[-0.18, -0.2], [0.1, -0.16], [0.3, -0.14], [0.45, -0.32], [0.5, 0.05], [0.44, 0.4], [0.28, 0.3], [0.08, 0.27], [-0.18, 0.25]] },
    { zona: 'umeri', pts: [[-0.18, 0.25], [0.08, 0.27], [0.28, 0.3], [0.44, 0.4], [0.34, 0.95], [0.14, 1.04], [-0.06, 0.98], [-0.17, 0.6]], fa: -4 },
    { zona: 'biceps', pts: [[0.6, -0.08], [0.78, -0.16], [0.95, -0.45], [1.0, -0.1], [0.94, 0.16], [0.75, 0.12]] },
    { zona: 'biceps', pts: [[0.36, -0.22], [0.41, -0.9], [0.55, -1.03], [0.72, -1.0], [0.88, -0.9], [0.96, -0.45], [0.8, -0.16], [0.55, -0.13]] },
    { zona: 'triceps', pts: [[0.4, 0.42], [0.45, 0.08], [0.62, 0.0], [0.78, 0.08], [0.8, 0.3], [0.62, 0.55]] },
    { zona: 'triceps', pts: [[0.4, 0.42], [0.62, 0.55], [0.8, 0.3], [0.94, 0.42], [0.98, 0.86], [0.8, 1.0], [0.55, 1.02], [0.42, 0.95]] },
  ],
  antebrat: [
    { zona: 'antebrate', pts: [[0.1, -0.2], [0.35, -0.3], [0.62, -0.52], [0.86, -0.82], [0.92, -0.25], [0.65, 0.02], [0.32, 0.04]] },
    { zona: 'antebrate', pts: [[-0.05, -0.3], [0.02, -0.96], [0.2, -1.02], [0.45, -0.86], [0.62, -0.52], [0.35, -0.3], [0.12, -0.24]] },
    { zona: 'antebrate', pts: [[0.0, 0.2], [0.06, 0.95], [0.3, 1.0], [0.6, 0.86], [0.86, 0.72], [0.92, 0.25], [0.62, 0.12], [0.3, 0.06]] },
  ],
  piept: [
    { zona: null, def: true, pts: [[0.42, 0.5], [0.45, 0.72], [0.49, 0.68], [0.48, 0.48]] },
    { zona: null, def: true, pts: [[0.49, 0.48], [0.52, 0.7], [0.56, 0.66], [0.55, 0.46]] },
    { zona: null, def: true, pts: [[0.56, 0.46], [0.59, 0.66], [0.62, 0.62], [0.62, 0.44]] },
    { zona: 'abdomen', pts: [[-0.06, 0.32], [-0.04, 0.72], [0.15, 0.8], [0.36, 0.74], [0.42, 0.46], [0.3, 0.2], [0.05, 0.14]], fa: 25 },
    { zona: 'abdomen', pts: bloc(0.3, 0.45, 0.78, 1.0) },
    { zona: 'abdomen', pts: bloc(0.13, 0.285, 0.78, 1.0) },
    { zona: 'abdomen', pts: bloc(-0.06, 0.115, 0.78, 1.0) },
    { zona: 'piept', pts: [[0.5, 0.72], [0.56, 0.93], [0.66, 1.01], [0.76, 1.01], [0.82, 0.84], [0.8, 0.5], [0.7, 0.42], [0.58, 0.5]], fa: 80 },
    { zona: 'piept', pts: [[0.8, 0.5], [0.82, 0.84], [0.88, 0.98], [0.94, 0.9], [0.97, 0.62], [0.92, 0.46]], fa: 70 },
    { zona: 'lombar', pts: [[-0.06, -0.96], [0.1, -1.0], [0.3, -0.98], [0.32, -0.72], [0.1, -0.62], [-0.06, -0.6]] },
    { zona: 'dorsali', pts: [[0.1, -0.7], [0.25, -0.97], [0.45, -1.01], [0.58, -0.96], [0.72, -0.76], [0.82, -0.45], [0.72, -0.3], [0.45, -0.34], [0.22, -0.45]], fa: 35 },
    { zona: 'spateMijloc', pts: [[0.72, -0.72], [0.84, -0.7], [0.88, -0.46], [0.8, -0.4]], fa: 60 },
    { zona: 'spateMijloc', pts: [[0.55, -0.97], [0.66, -1.03], [0.8, -1.01], [0.88, -0.9], [0.84, -0.72], [0.74, -0.74], [0.6, -0.86]], fa: 70 },
    { zona: 'trapez', pts: [[0.86, -0.9], [0.94, -0.94], [1.02, -0.88], [1.08, -0.72], [1.0, -0.4], [0.9, -0.62]] },
  ],
  bazin: [
    { zona: null, def: true, pts: [[0.0, 0.45], [0.15, 0.62], [0.38, 0.46], [0.3, 0.2], [0.1, 0.26]] },
    { zona: ['fese', 'abductori'], pts: [[0.24, -0.94], [0.42, -0.92], [0.55, -0.6], [0.46, -0.24], [0.32, -0.36], [0.35, -0.72]] },
    { zona: 'fese', pts: [[-0.36, -0.55], [-0.22, -0.98], [0.0, -1.03], [0.24, -0.98], [0.38, -0.76], [0.3, -0.45], [0.05, -0.35], [-0.2, -0.3]], fa: 30 },
    { zona: 'lombar', pts: [[0.5, -0.98], [0.75, -0.99], [1.04, -0.98], [1.04, -0.62], [0.75, -0.62], [0.52, -0.72]] },
    { zona: 'abdomen', pts: [[0.45, 0.1], [0.6, 0.66], [0.85, 0.72], [1.04, 0.7], [1.04, 0.3], [0.8, 0.1]], fa: 25 },
    { zona: 'abdomen', pts: [[0.05, 0.6], [0.1, 0.9], [0.3, 0.98], [0.52, 0.96], [0.52, 0.72], [0.3, 0.62]] },
    { zona: 'abdomen', pts: bloc(0.56, 1.04, 0.74, 1.0) },
  ],
  coapsa: [
    { zona: 'cvadriceps', pts: [[0.12, -0.4], [0.35, -0.4], [0.62, -0.43], [0.82, -0.56], [0.96, -0.72], [1.0, -0.2], [0.9, 0.32], [0.65, 0.56], [0.4, 0.5], [0.15, 0.36]] },
    { zona: 'cvadriceps', pts: [[0.04, -0.55], [0.08, -0.95], [0.3, -1.02], [0.55, -0.99], [0.78, -0.9], [0.92, -0.66], [0.76, -0.45], [0.45, -0.42], [0.2, -0.45]] },
    { zona: 'femurali', pts: [[0.1, 0.45], [0.12, 0.96], [0.35, 1.02], [0.6, 0.99], [0.82, 0.95], [0.93, 0.75], [0.86, 0.45], [0.6, 0.56], [0.35, 0.48]] },
    { zona: null, def: true, pts: [[0.93, -0.55], [0.97, -0.95], [1.06, -0.98], [1.08, -0.6], [1.0, -0.45]] },
  ],
  gamba: [
    { zona: null, def: true, pts: [[0.08, -0.4], [0.12, -0.98], [0.4, -1.0], [0.65, -0.86], [0.72, -0.55], [0.45, -0.34]] },
    { zona: 'gambe', pts: [[0.38, 0.3], [0.5, 0.32], [0.56, 0.6], [0.7, 0.86], [0.82, 0.7], [0.84, 0.3], [0.65, 0.14]] },
    { zona: 'gambe', pts: [[0.04, 0.2], [0.08, 0.96], [0.24, 1.03], [0.42, 0.93], [0.56, 0.6], [0.5, 0.3], [0.3, 0.14]] },
  ],
};

// Capul din profil (cadrul capului: t de la baza gâtului în sus, +y = fața)
const CAP_L = [[0.0, -4.6], [0.18, -6.4], [0.38, -9.1], [0.62, -9.5], [0.86, -7.5], [1.0, -2.0], [0.98, 3.4], [0.86, 7.4], [0.68, 8.9],
  [0.62, 9.2], [0.54, 11.0], [0.49, 9.9], [0.44, 9.9], [0.4, 9.6], [0.35, 9.7], [0.29, 8.9], [0.23, 7.2], [0.15, 4.2], [0.0, 4.0]];
const PAR_L = [[0.66, 8.6], [0.86, 7.5], [1.0, 2.0], [1.0, -2.0], [0.86, -7.6], [0.62, -9.6], [0.46, -9.4], [0.54, -7.4], [0.7, -5.4], [0.78, -1.4], [0.78, 3.6], [0.74, 6.4]];

function capLateral(cad, lod) {
  const pc = { d: forma(cad, CAP_L, 0.45), cad, w: 9.5, ton: 'piele', muschi: [], puncte: puncteForma(cad, CAP_L) };
  const stilDef = ' fill="none" stroke="rgba(14,16,20,0.55)" stroke-width="0.45" stroke-linecap="round"';
  pc.detalii = [
    { d: forma(cad, PAR_L, 0.5), stil: ` fill="url(#par)" stroke="rgba(0,0,0,0.25)" stroke-width="0.3"`, mereu: true, par: true },
    { d: forma(cad, [[0.46, -2.5], [0.6, -3.4], [0.66, -2.1], [0.58, -1.0], [0.46, -1.3]]), stil: ' fill="rgba(0,0,0,0.14)" stroke="rgba(14,16,20,0.55)" stroke-width="0.4"', mereu: true },
    { d: curbaDeschisa(puncteForma(cad, [[0.62, 6.0], [0.64, 7.2], [0.62, 8.0]])), stil: stilDef },
    { d: curbaDeschisa(puncteForma(cad, [[0.69, 5.4], [0.72, 6.8], [0.7, 8.4]])), stil: ' fill="none" stroke="rgba(14,16,20,0.6)" stroke-width="0.6" stroke-linecap="round"' },
    { d: curbaDeschisa(puncteForma(cad, [[0.36, 8.6], [0.37, 9.6]])), stil: stilDef },
    { d: curbaDeschisa(puncteForma(cad, [[0.2, 6.2], [0.2, 2.4], [0.36, -1.4]])), stil: ' fill="none" stroke="rgba(14,16,20,0.32)" stroke-width="0.45" stroke-linecap="round"' },
  ];
  return pc;
}

// Mâna din profil: pumn (prinde o bară) sau palmă deschisă (sprijin).
function manaLaterala(cad, palma) {
  const stil = ' fill="none" stroke="rgba(14,16,20,0.5)" stroke-width="0.38" stroke-linecap="round"';
  if (palma === 'deschisa') {
    const pts = [[-0.1, -2.3], [0.4, -2.7], [0.75, -2.1], [1.18, -1.4], [1.3, -0.2], [1.16, 0.9], [0.55, 2.4], [-0.1, 2.3]];
    return { d: forma(cad, pts), cad, w: 3, ton: 'piele', puncte: puncteForma(cad, pts),
      detalii: [{ d: curbaDeschisa(puncteForma(cad, [[0.68, -0.6], [0.95, -0.4], [1.2, -0.3]])), stil }, { d: curbaDeschisa(puncteForma(cad, [[0.62, 0.6], [0.92, 0.4], [1.15, 0.5]])), stil }] };
  }
  const pts = [[-0.1, -2.5], [0.25, -3.0], [0.7, -3.2], [1.0, -2.5], [1.12, -0.7], [1.05, 1.6], [0.8, 2.8], [0.35, 2.8], [-0.1, 2.2]];
  return { d: forma(cad, pts), cad, w: 3.2, ton: 'piele', puncte: puncteForma(cad, pts),
    detalii: [
      { d: curbaDeschisa(puncteForma(cad, [[0.78, -2.6], [0.98, -1.2], [0.98, 0.3]])), stil },
      { d: curbaDeschisa(puncteForma(cad, [[0.62, -0.4], [0.86, 0.2], [0.9, 1.6]])), stil },
      { d: forma(cad, [[0.25, -2.6], [0.5, -3.7], [0.84, -3.5], [0.88, -2.7], [0.6, -2.4]]), stil: ' fill="rgba(255,255,255,0.05)" stroke="rgba(14,16,20,0.45)" stroke-width="0.35"' },
    ] };
}

// Pantoful din profil (cadrul labei: de la gleznă spre vârf).
function labaLaterala(cad) {
  const pts = [[-0.28, 5.2], [-0.31, 1.0], [-0.12, -2.4], [0.14, -2.9], [0.5, -0.6], [0.88, 2.4], [1.02, 4.9], [0.98, 6.4], [0.5, 6.7], [0.0, 6.8], [-0.3, 6.4]];
  const talpa = [[-0.31, 5.6], [0.0, 5.9], [0.5, 5.8], [1.0, 5.4], [1.0, 6.6], [0.5, 6.8], [0.0, 6.9], [-0.3, 6.5]];
  return { d: forma(cad, pts), cad, w: 6, ton: 'pantof', puncte: puncteForma(cad, pts),
    detalii: [
      { d: forma(cad, talpa), stil: ' fill="#9AA2AC" opacity="0.55"', mereu: true },
      { d: curbaDeschisa(puncteForma(cad, [[0.1, -1.8], [0.3, 0.4], [0.5, 2.4]])), stil: ' fill="none" stroke="rgba(255,255,255,0.14)" stroke-width="0.5"' },
    ] };
}

// Gât (între piept și cap)
function gatLateral(piept, cap) {
  const c = cadru(piept.p(0.96, -0.6), cap.unghi, 10);
  const pts = [[0, -4.6], [1.05, -4.0], [1.05, 4.2], [0, 5.2]];
  return { d: forma(c, pts), cad: c, w: 5, ton: 'piele', puncte: puncteForma(c, pts),
    detalii: [{ d: curbaDeschisa(puncteForma(c, [[0.15, 3.8], [0.6, 0.6], [1.0, -2.6]])), stil: ' fill="none" stroke="rgba(14,16,20,0.35)" stroke-width="0.45"' }] };
}

// u = { bazin, piept, cap, aproape: {brat, antebrat, coapsa, gamba, laba, mana, palma, bratScara, antebratScara, coapsaScara, gambaScara}, departe }
function lateral(u) {
  const H = [0, 0];
  const bazin = cadru(H, u.bazin, LUNG.bazin);
  const W = bazin.p(1, 0);
  const piept = cadru(W, u.piept, LUNG.piept);
  const N = piept.p(1.02, 0);
  const cap = cadru(N, u.cap ?? u.piept, LUNG.cap);
  const umar = piept.p(0.86, -1.5);
  const membre = {};
  for (const parte of ['aproape', 'departe']) {
    const m = u[parte];
    const brat = cadru(umar, m.brat, LUNG.brat * (m.bratScara || 1));
    const antebrat = cadru(brat.p(1, 0), m.antebrat, LUNG.antebrat * (m.antebratScara || 1));
    const mana = cadru(antebrat.p(1, 0), m.antebrat + (m.mana || 0), LUNG.mana);
    const coapsa = cadru(H, m.coapsa, LUNG.coapsa * (m.coapsaScara || 1));
    const gamba = cadru(coapsa.p(1, 0), m.gamba, LUNG.gamba * (m.gambaScara || 1));
    const laba = cadru(gamba.p(1, 0), m.laba ?? 0, LUNG.laba);
    membre[parte] = { brat, antebrat, mana, coapsa, gamba, laba, palma: m.palma, ascunde: m.ascunde || {} };
  }
  return { vedere: 'lateral', bazin, piept, cap, membre, umar, sold: H };
}

function pieseLateral(poza, lod) {
  const { membre: M } = poza;
  const membru = (m) => ({
    brat: piesaSegment(m.brat, PROFIL_L.brat, MUSCHI_L.brat),
    antebrat: piesaSegment(m.antebrat, PROFIL_L.antebrat, MUSCHI_L.antebrat),
    mana: manaLaterala(m.mana, m.palma),
    coapsa: piesaSegment(m.coapsa, PROFIL_L.coapsa, MUSCHI_L.coapsa),
    gamba: piesaSegment(m.gamba, PROFIL_L.gamba, MUSCHI_L.gamba),
    laba: labaLaterala(m.laba),
  });
  const D = membru(M.departe), A = membru(M.aproape);
  const ascunde = (m, piese) => piese.filter(([k]) => !m.ascunde[k]).map(([, v]) => v);
  return {
    departe: ascunde(M.departe, [['coapsa', D.coapsa], ['gamba', D.gamba], ['laba', D.laba], ['brat', D.brat], ['antebrat', D.antebrat], ['mana', D.mana]]),
    trunchi: [piesaSegment(poza.bazin, PROFIL_L.bazin, MUSCHI_L.bazin), piesaSegment(poza.piept, PROFIL_L.piept, MUSCHI_L.piept), gatLateral(poza.piept, poza.cap), capLateral(poza.cap, lod)],
    picior: ascunde(M.aproape, [['coapsa', A.coapsa], ['gamba', A.gamba], ['laba', A.laba]]),
    brat: ascunde(M.aproape, [['brat', A.brat], ['antebrat', A.antebrat], ['mana', A.mana]]),
  };
}

// ======================================================================
//  VEDERE FRONTALĂ (din față sau din spate)
// ======================================================================
const LUNG_F = { trunchi: 56, brat: 30, antebrat: 25, coapsa: 45, gamba: 43, mana: 8.5, laba: 8, cap: 23 };
const UMAR_F = [0.9, 15.0];
const SOLD_F = [-0.02, 8.0];

// Conturul trunchiului (jumătatea dreaptă a imaginii; x ≥ 0), de jos (între picioare) până la gât.
const TRUNCHI_F = [[-0.2, 0], [-0.19, 3.0], [-0.12, 9.5], [-0.02, 15.6], [0.12, 16.2], [0.24, 15.2], [0.34, 13.5], [0.42, 13.2], [0.52, 14.1],
  [0.64, 15.5], [0.74, 16.7], [0.84, 17.5], [0.92, 17.3], [0.97, 14.6], [1.0, 10.0], [1.03, 7.0], [1.06, 5.6]];

const MUSCHI_TRUNCHI_F = {
  fata: [
    { zona: 'trapez', pts: [[0.96, 5.6], [1.02, 6.6], [0.99, 10.0], [0.95, 14.8], [0.93, 12.0], [0.94, 8.0]] },
    { zona: 'abdomen', pts: [[0.16, 7.0], [0.12, 12.4], [0.2, 15.0], [0.34, 13.2], [0.48, 13.7], [0.6, 14.9], [0.62, 11.5], [0.5, 7.4], [0.35, 6.8]], fa: 25 },
    { zona: null, pts: [[0.6, 13.6], [0.62, 15.2], [0.65, 15.4], [0.64, 13.4]] },
    { zona: null, pts: [[0.65, 13.8], [0.67, 15.6], [0.7, 15.8], [0.69, 13.6]] },
    { zona: 'abdomen', pts: [[0.53, 0.9], [0.535, 3.4], [0.54, 6.0], [0.6, 6.1], [0.615, 3.4], [0.61, 0.9]] },
    { zona: 'abdomen', pts: [[0.44, 0.9], [0.445, 3.5], [0.45, 6.2], [0.515, 6.1], [0.52, 3.5], [0.515, 0.9]] },
    { zona: 'abdomen', pts: [[0.35, 0.9], [0.355, 3.5], [0.36, 6.0], [0.425, 6.1], [0.43, 3.5], [0.425, 0.9]] },
    { zona: 'abdomen', pts: [[0.1, 0.9], [0.14, 3.6], [0.2, 5.5], [0.335, 5.9], [0.34, 3.5], [0.335, 0.9]] },
    { zona: ['fese', 'abductori'], pts: [[0.0, 15.6], [0.12, 16.1], [0.24, 15.0], [0.22, 12.6], [0.1, 13.4], [0.02, 14.0]] },
    { zona: 'dorsali', pts: [[0.5, 14.0], [0.6, 15.4], [0.72, 16.6], [0.82, 17.4], [0.8, 15.6], [0.7, 14.0], [0.6, 13.3]], fa: -20 },
    { zona: 'piept', pts: [[0.67, 1.0], [0.64, 4.0], [0.635, 8.0], [0.67, 12.0], [0.75, 15.2], [0.83, 16.4], [0.86, 13.5], [0.86, 7.5], [0.85, 1.0]], fa: 75 },
    { zona: 'piept', pts: [[0.85, 1.0], [0.86, 7.5], [0.86, 13.5], [0.83, 16.4], [0.89, 16.6], [0.935, 13.0], [0.945, 7.0], [0.93, 1.0]], fa: 80 },
  ],
  spate: [
    { zona: 'lombar', pts: [[0.08, 0.6], [0.1, 5.0], [0.24, 6.3], [0.42, 5.4], [0.52, 3.0], [0.5, 0.6]] },
    { zona: 'abdomen', pts: [[0.18, 13.4], [0.3, 13.6], [0.42, 13.0], [0.36, 10.6], [0.24, 11.0]] },
    { zona: 'dorsali', pts: [[0.54, 0.5], [0.66, 5.0], [0.8, 9.2], [0.72, 11.0], [0.74, 15.6], [0.84, 17.0], [0.7, 16.3], [0.55, 14.7], [0.42, 12.9], [0.3, 8.0], [0.26, 2.5], [0.4, 0.5]], fa: -30 },
    { zona: 'spateMijloc', pts: [[0.9, 9.5], [0.9, 15.2], [0.84, 16.6], [0.74, 15.5], [0.72, 11.0], [0.8, 9.2]], fa: 80 },
    { zona: 'spateMijloc', pts: [[0.8, 0.5], [0.86, 6.0], [0.9, 9.5], [0.8, 9.2], [0.66, 5.0], [0.54, 0.5]], fa: 60 },
    { zona: 'trapez', pts: [[1.05, 0.5], [1.04, 6.4], [0.99, 10.0], [0.95, 15.0], [0.9, 13.0], [0.86, 6.0], [0.8, 0.5]], fa: 70 },
    { zona: 'fese', pts: [[-0.21, 0.5], [-0.22, 6.0], [-0.16, 12.0], [-0.04, 15.2], [0.1, 15.4], [0.16, 11.0], [0.14, 5.0], [0.1, 0.8]], fa: 60 },
    { zona: ['fese', 'abductori'], pts: [[0.1, 11.2], [0.12, 15.6], [0.24, 15.0], [0.25, 11.0], [0.2, 8.0]] },
  ],
};

// Membre frontale: +y = partea exterioară (laterală).
const PROFIL_F = {
  brat: [[-0.2, 4.4, 6.2], [0.02, 5.6, 8.4], [0.22, 5.4, 8.0], [0.42, 5.0, 6.3], [0.7, 4.6, 4.8], [0.92, 3.9, 4.1], [1.06, 3.6, 3.8]],
  antebrat: [[-0.08, 4.2, 4.4], [0.18, 4.6, 5.2], [0.45, 3.9, 3.9], [0.7, 3.0, 3.0], [0.95, 2.5, 2.5], [1.06, 2.4, 2.4]],
  coapsa: [[-0.12, 5.6, 7.6], [0.06, 7.6, 8.4], [0.3, 7.5, 8.4], [0.55, 6.6, 7.6], [0.8, 5.3, 6.1], [0.95, 4.7, 5.1], [1.06, 4.5, 4.7]],
  gamba: [[-0.06, 4.6, 4.7], [0.15, 5.6, 5.0], [0.35, 5.0, 4.6], [0.6, 3.7, 3.6], [0.85, 2.8, 2.8], [1.04, 2.6, 2.6]],
};
const MUSCHI_F = {
  fata: {
    brat: [
      { zona: 'triceps', pts: [[0.42, 0.55], [0.6, 0.5], [0.74, 0.85], [0.55, 1.0], [0.42, 0.98]] },
      { zona: 'biceps', pts: [[0.6, 0.4], [0.8, 0.34], [0.95, 0.55], [0.86, 0.95], [0.66, 0.95]] },
      { zona: 'biceps', pts: [[0.38, -0.76], [0.55, -0.86], [0.78, -0.72], [0.93, -0.3], [0.86, 0.12], [0.6, 0.22], [0.42, 0.0]] },
      { zona: 'umeri', pts: [[-0.18, -0.2], [-0.02, -0.92], [0.18, -0.76], [0.42, -0.1], [0.36, 0.25], [0.1, 0.3], [-0.1, 0.24]], fa: 6 },
      { zona: 'umeri', pts: [[-0.1, 0.24], [0.1, 0.3], [0.36, 0.25], [0.45, 0.56], [0.28, 1.0], [0.05, 1.04], [-0.16, 0.86]] },
    ],
    antebrat: [
      { zona: 'antebrate', pts: [[0.05, -0.05], [0.05, -1.0], [0.35, -0.96], [0.8, -0.6], [0.88, -0.1], [0.5, 0.1]] },
      { zona: 'antebrate', pts: [[0.0, 0.2], [0.04, 1.0], [0.3, 0.96], [0.62, 0.56], [0.5, 0.15], [0.2, 0.05]] },
    ],
    coapsa: [
      { zona: 'adductori', pts: [[-0.08, -0.2], [-0.05, -1.0], [0.2, -1.03], [0.5, -0.86], [0.6, -0.46], [0.4, -0.3], [0.1, -0.2]], fa: -15 },
      { zona: 'cvadriceps', pts: [[0.12, 0.45], [0.15, 1.0], [0.45, 1.03], [0.75, 0.96], [0.92, 0.6], [0.88, 0.1], [0.75, 0.3], [0.4, 0.45]] },
      { zona: 'cvadriceps', pts: [[0.55, -0.4], [0.72, -0.96], [0.9, -0.96], [0.98, -0.5], [0.88, -0.1], [0.75, -0.25]] },
      { zona: 'cvadriceps', pts: [[0.06, -0.15], [0.1, 0.4], [0.4, 0.46], [0.75, 0.3], [0.88, 0.0], [0.75, -0.26], [0.4, -0.3]] },
      { zona: null, def: true, pts: [[0.93, 0.0], [0.97, -0.5], [1.03, -0.45], [1.06, 0.0], [1.03, 0.45], [0.97, 0.5]] },
    ],
    gamba: [
      { zona: null, def: true, pts: [[0.08, 0.0], [0.1, 0.7], [0.4, 0.75], [0.7, 0.4], [0.65, 0.0], [0.35, -0.1]] },
      { zona: 'gambe', pts: [[0.05, -0.6], [0.1, -1.02], [0.35, -1.02], [0.5, -0.76], [0.35, -0.45]] },
      { zona: 'gambe', pts: [[0.4, -0.7], [0.6, -0.96], [0.78, -0.6], [0.6, -0.4]] },
      { zona: 'gambe', pts: [[0.08, 0.75], [0.12, 1.02], [0.35, 0.99], [0.42, 0.8], [0.25, 0.74]] },
    ],
  },
  spate: {
    brat: [
      { zona: 'umeri', pts: [[-0.18, -0.4], [-0.02, -0.92], [0.2, -0.72], [0.42, -0.05], [0.3, 0.3], [0.05, 0.3], [-0.12, 0.2]], fa: -6 },
      { zona: 'umeri', pts: [[-0.1, 0.2], [0.05, 0.3], [0.3, 0.3], [0.45, 0.56], [0.28, 1.0], [0.05, 1.04], [-0.16, 0.86]] },
      { zona: 'triceps', pts: [[0.4, -0.92], [0.62, -0.96], [0.85, -0.6], [0.93, -0.1], [0.7, -0.04], [0.5, -0.2], [0.38, -0.5]] },
      { zona: 'triceps', pts: [[0.44, 0.1], [0.5, 0.55], [0.44, 0.92], [0.62, 0.96], [0.82, 0.56], [0.9, 0.1], [0.7, -0.04]] },
    ],
    antebrat: [
      { zona: 'antebrate', pts: [[0.02, -0.9], [0.3, -0.96], [0.75, -0.56], [0.88, 0.0], [0.7, 0.6], [0.35, 0.96], [0.05, 0.96], [0.0, 0.0]] },
    ],
    coapsa: [
      { zona: 'adductori', pts: [[-0.05, -0.6], [0.0, -1.02], [0.3, -1.02], [0.4, -0.8], [0.2, -0.6]] },
      { zona: 'femurali', pts: [[0.08, 0.0], [0.12, 0.92], [0.5, 0.96], [0.85, 0.7], [0.92, 0.1], [0.6, 0.05]] },
      { zona: 'femurali', pts: [[0.12, -0.05], [0.2, -0.6], [0.5, -0.9], [0.85, -0.66], [0.92, -0.1], [0.6, -0.05]] },
    ],
    gamba: [
      { zona: 'gambe', pts: [[0.45, -0.76], [0.6, -0.86], [0.8, -0.4], [0.8, 0.4], [0.6, 0.8], [0.45, 0.7], [0.55, 0.0]] },
      { zona: 'gambe', pts: [[0.04, -0.05], [0.08, -0.96], [0.3, -1.03], [0.52, -0.7], [0.5, -0.05]] },
      { zona: 'gambe', pts: [[0.04, 0.05], [0.08, 0.9], [0.28, 0.96], [0.46, 0.6], [0.48, 0.05]] },
    ],
  },
};

function manaFrontala(cad, oglinda, palma) {
  const pts = palma === 'deschisa'
    ? [[-0.05, -1.0], [0.5, -1.25], [1.05, -1.0], [1.25, 0], [1.05, 1.0], [0.5, 1.25], [-0.05, 1.0]]
    : [[-0.05, -0.95], [0.4, -1.08], [0.9, -0.9], [1.08, 0], [0.9, 0.9], [0.4, 1.1], [-0.05, 0.95]];
  const w = 3.3;
  const ptsW = pts.map(([t, k]) => cad.p(t, k * w * oglinda));
  const stil = ' fill="none" stroke="rgba(14,16,20,0.45)" stroke-width="0.38" stroke-linecap="round"';
  return { d: curbaInchisa(ptsW), cad, w, ton: 'piele', puncte: ptsW,
    detalii: [{ d: curbaDeschisa([cad.p(0.72, -2.6 * oglinda), cad.p(0.8, 0), cad.p(0.72, 2.6 * oglinda)]), stil }] };
}

function labaFrontala(cad, oglinda) {
  // pantoful văzut din față/spate: de la gleznă în jos, ușor spre exterior
  const pts = [[-0.1, -0.75], [0.45, -0.95], [0.95, -1.05], [1.12, -0.2], [1.1, 1.1], [0.95, 1.35], [0.45, 1.05], [-0.1, 0.8]];
  const w = 3.6;
  const ptsW = pts.map(([t, k]) => cad.p(t, k * w * oglinda));
  return { d: curbaInchisa(ptsW), cad, w: 4.5, ton: 'pantof', puncte: ptsW,
    detalii: [{ d: curbaDeschisa([cad.p(0.95, -3.6 * oglinda), cad.p(1.0, 1.0 * oglinda), cad.p(0.92, 4.6 * oglinda)]), stil: ' fill="none" stroke="#9AA2AC" stroke-width="1.1" opacity="0.5"', mereu: true }] };
}

function capFrontal(cad, spate) {
  // cadrul capului: t de la bărbie/ceafă în sus; y = lateral (+ dreapta imaginii)
  const contur = [[0.0, 0], [0.04, -3.6], [0.22, -6.6], [0.5, -7.6], [0.78, -7.0], [0.96, -4.0], [1.02, 0], [0.96, 4.0], [0.78, 7.0], [0.5, 7.6], [0.22, 6.6], [0.04, 3.6]];
  const pc = { d: forma(cad, contur, 0.5), cad, w: 7.6, ton: 'piele', muschi: [], puncte: puncteForma(cad, contur) };
  const urechi = s => ({ d: forma(cad, [[0.38, 7.0 * s], [0.6, 8.3 * s], [0.62, 7.0 * s], [0.42, 6.6 * s]]), stil: ' fill="rgba(0,0,0,0.12)" stroke="rgba(14,16,20,0.5)" stroke-width="0.4"', mereu: true });
  const stil = ' fill="none" stroke="rgba(14,16,20,0.55)" stroke-width="0.45" stroke-linecap="round"';
  if (spate) {
    pc.detalii = [urechi(1), urechi(-1),
      { d: forma(cad, [[0.2, -6.2], [0.5, -7.7], [0.8, -7.1], [0.98, -4.0], [1.03, 0], [0.98, 4.0], [0.8, 7.1], [0.5, 7.7], [0.2, 6.2], [0.24, 0]]), stil: ' fill="url(#par)" stroke="rgba(0,0,0,0.25)" stroke-width="0.3"', mereu: true }];
  } else {
    pc.detalii = [urechi(1), urechi(-1),
      { d: forma(cad, [[0.66, -7.4], [0.84, -6.8], [0.98, -4.0], [1.03, 0], [0.98, 4.0], [0.84, 6.8], [0.66, 7.4], [0.74, 4.6], [0.82, 0], [0.74, -4.6]]), stil: ' fill="url(#par)" stroke="rgba(0,0,0,0.25)" stroke-width="0.3"', mereu: true },
      { d: curbaDeschisa(puncteForma(cad, [[0.6, -4.6], [0.63, -3.2], [0.6, -1.6]])), stil },
      { d: curbaDeschisa(puncteForma(cad, [[0.6, 1.6], [0.63, 3.2], [0.6, 4.6]])), stil },
      { d: curbaDeschisa(puncteForma(cad, [[0.53, -4.0], [0.55, -3.0], [0.53, -2.2]])), stil: ' fill="none" stroke="rgba(14,16,20,0.65)" stroke-width="0.7" stroke-linecap="round"' },
      { d: curbaDeschisa(puncteForma(cad, [[0.53, 2.2], [0.55, 3.0], [0.53, 4.0]])), stil: ' fill="none" stroke="rgba(14,16,20,0.65)" stroke-width="0.7" stroke-linecap="round"' },
      { d: curbaDeschisa(puncteForma(cad, [[0.52, -0.4], [0.36, -1.0], [0.33, 0.6]])), stil },
      { d: curbaDeschisa(puncteForma(cad, [[0.2, -2.0], [0.19, 0], [0.2, 2.0]])), stil },
    ];
  }
  return pc;
}

// u = { vedere: 'fata'|'spate', trunchi: unghi (−90 = în sus), trunchiScara, cap: abatere, st: {...}, dr: {...} }
// st = membrele din stânga imaginii, dr = din dreapta. Unghiurile: 90 = în jos.
function frontal(u) {
  const T = cadru([0, 0], u.trunchi ?? -90, LUNG_F.trunchi * (u.trunchiScara || 1));
  // în vederea frontală, +y al trunchiului = dreapta imaginii (dacă trunchiul e vertical)
  const latura = s => ({
    umar: T.p(UMAR_F[0] + (u.ridicare || 0) / LUNG_F.trunchi, (UMAR_F[1] - (u.ridicare || 0) * 0.15) * s),
    sold: T.p(SOLD_F[0], SOLD_F[1] * s),
  });
  const membre = {};
  for (const [parte, s] of [['st', -1], ['dr', 1]]) {
    const m = u[parte];
    const L = latura(s);
    const brat = cadru(L.umar, m.brat, LUNG_F.brat * (m.bratScara || 1));
    const antebrat = cadru(brat.p(1, 0), m.antebrat, LUNG_F.antebrat * (m.antebratScara || 1));
    const mana = cadru(antebrat.p(1, 0), m.antebrat + (m.mana || 0), LUNG_F.mana * (m.manaScara || 1));
    const coapsa = cadru(L.sold, m.coapsa, LUNG_F.coapsa * (m.coapsaScara || 1));
    const gamba = cadru(coapsa.p(1, 0), m.gamba, LUNG_F.gamba * (m.gambaScara || 1));
    const laba = cadru(gamba.p(1, 0), m.laba ?? m.gamba, LUNG_F.laba * (m.labaScara || 1));
    membre[parte] = { s, brat, antebrat, mana, coapsa, gamba, laba, palma: m.palma, ascunde: m.ascunde || {} };
  }
  const gatBaza = T.p(1.0, 0);
  const cap = cadru(T.p(1.1 + (u.gat || 0), 0), (u.trunchi ?? -90) + (u.cap || 0), LUNG_F.cap * (u.capScara || 1));
  return { vedere: u.vedere || 'fata', trunchi: T, cap, gatBaza, membre };
}

function pieseFrontal(poza) {
  const fata = poza.vedere !== 'spate';
  const set = fata ? 'fata' : 'spate';
  const T = poza.trunchi;
  // în spate, stânga imaginii e partea stângă a persoanei — mușchii sunt simetrici, deci același set
  const trunchiPts = [...TRUNCHI_F.map(([t, x]) => T.p(t, x)), ...TRUNCHI_F.slice().reverse().map(([t, x]) => T.p(t, -x))];
  const muschiTrunchi = [];
  for (const s of [-1, 1]) {
    for (const x of MUSCHI_TRUNCHI_F[set]) {
      const pts = x.pts.map(([t, y]) => T.p(t, y * s));
      const fa = (x.fa || 0) * Math.PI / 180;
      const dirF = [T.d[0] * Math.cos(fa) + T.n[0] * Math.sin(fa) * s, T.d[1] * Math.cos(fa) + T.n[1] * Math.sin(fa) * s];
      muschiTrunchi.push({ d: curbaInchisa(pts), pts, zone: [].concat(x.zona || []), def: x.def ?? true, dirFibre: x.zona ? dirF : null });
    }
  }
  const linieMijloc = fata
    ? curbaDeschisa([T.p(0.12, 0), T.p(0.4, 0), T.p(0.64, 0)])
    : curbaDeschisa([T.p(0.08, 0), T.p(0.5, 0), T.p(0.98, 0)]);
  const trunchi = { d: curbaInchisa(trunchiPts), cad: T, w: 17, ton: 'piele', muschi: muschiTrunchi, puncte: trunchiPts,
    detalii: [{ d: linieMijloc, stil: ' fill="none" stroke="rgba(14,16,20,0.4)" stroke-width="0.5"' }] };
  const gatCad = cadru(T.p(0.96, 0), poza.cap.unghi, (dist(T.p(0.96, 0), poza.cap.o) + 2));
  const gatPts = [[0, -6.4], [1, -5.4], [1, 5.4], [0, 6.4]];
  const gat = { d: forma(gatCad, gatPts), cad: gatCad, w: 6, ton: 'piele', puncte: puncteForma(gatCad, gatPts),
    detalii: fata ? [{ d: curbaDeschisa(puncteForma(gatCad, [[0.05, -1.2], [0.6, -3.8], [1, -4.4]])), stil: ' fill="none" stroke="rgba(14,16,20,0.35)" stroke-width="0.45"' },
      { d: curbaDeschisa(puncteForma(gatCad, [[0.05, 1.2], [0.6, 3.8], [1, 4.4]])), stil: ' fill="none" stroke="rgba(14,16,20,0.35)" stroke-width="0.45"' }] : [] };
  const membre = { st: null, dr: null };
  for (const parte of ['st', 'dr']) {
    const m = poza.membre[parte];
    const og = -m.s; // +y local = exterior
    const ms = MUSCHI_F[set];
    const p = {
      coapsa: piesaSegment(m.coapsa, PROFIL_F.coapsa, ms.coapsa, { oglinda: og }),
      gamba: piesaSegment(m.gamba, PROFIL_F.gamba, ms.gamba, { oglinda: og }),
      laba: labaFrontala(m.laba, og),
      brat: piesaSegment(m.brat, PROFIL_F.brat, ms.brat, { oglinda: og }),
      antebrat: piesaSegment(m.antebrat, PROFIL_F.antebrat, ms.antebrat, { oglinda: og }),
      mana: manaFrontala(m.mana, og, m.palma),
    };
    for (const k of Object.keys(m.ascunde)) if (m.ascunde[k]) p[k] = null;
    membre[parte] = p;
  }
  const S = membre.st, D = membre.dr;
  return {
    picioare: [S.coapsa, S.gamba, S.laba, D.coapsa, D.gamba, D.laba],
    trunchi: [gat, trunchi, capFrontal(poza.cap, !fata)],
    brate: [S.brat, S.antebrat, S.mana, D.brat, D.antebrat, D.mana],
  };
}

// ---------- API ----------
// Construiește piesele corpului (fără desen); poza vine din lateral() sau frontal().
function piese(poza, lod) { return poza.vedere === 'lateral' ? pieseLateral(poza, lod) : pieseFrontal(poza, lod); }

function puncteCorp(pieseCorp) {
  const pts = [];
  for (const grup of Object.values(pieseCorp)) for (const pc of grup) if (pc && pc.puncte) pts.push(...pc.puncte);
  return pts;
}

// Repere utile echipamentului.
function repere(poza) {
  if (poza.vedere === 'lateral') {
    const M = poza.membre;
    const r = {};
    for (const parte of ['aproape', 'departe']) {
      const m = M[parte];
      r[parte] = {
        prindere: m.mana.p(0.5, 0), incheietura: m.mana.o, cot: m.antebrat.o, umar: m.brat.o,
        genunchi: m.gamba.o, glezna: m.laba.o, varf: m.laba.p(0.92, 5.6), calcai: m.laba.p(-0.2, 6.4),
        talpa: m.laba.p(0.3, 6.8), soldPartea: m.coapsa.o, coapsaMijloc: m.coapsa.p(0.5, 0),
        gambaFata: m.gamba.p(0.85, -3.2), gambaSpate: m.gamba.p(0.88, 3.4), coapsaSus: m.coapsa.p(0.85, -7),
      };
    }
    r.ceafa = poza.piept.p(0.93, -9.8);
    r.pieptFata = poza.piept.p(0.72, 13.6);
    r.claviculaFata = poza.piept.p(0.93, 9.5);
    r.spateSus = poza.piept.p(0.8, -12.4);
    r.spateMijloc = poza.piept.p(0.5, -12);
    r.fese = poza.bazin.p(-0.15, -12.8);
    r.bazinFata = poza.bazin.p(0.0, 9.4);
    r.capVarf = poza.cap.p(1.0, 0);
    r.sold = poza.sold;
    return r;
  }
  const r = { };
  for (const parte of ['st', 'dr']) {
    const m = poza.membre[parte];
    r[parte] = { prindere: m.mana.p(0.5, 0), cot: m.antebrat.o, umar: m.brat.o, genunchi: m.gamba.o, glezna: m.laba.o, talpa: m.laba.p(1.1, 0), sold: m.coapsa.o, coapsaInterior: m.coapsa.p(0.7, 7 * m.s), coapsaExterior: m.coapsa.p(0.7, -8.5 * m.s) };
  }
  r.trunchi = poza.trunchi;
  r.capVarf = poza.cap.p(1.02, 0);
  r.ceafa = poza.trunchi.p(1.0, 0);
  r.piept = poza.trunchi.p(0.78, 0);
  return r;
}

module.exports = { lateral, frontal, piese, strat, puncteCorp, repere, LUNG, LUNG_F, C };
