// Abdomen: crunch-uri, plank, ridicări de picioare, răsuciri, dead bug, Pallof, rollout, tăietorul de lemne.
'use strict';
const S = require('../scena');
const { E, L, F, add, mul, lerp } = S;
const { dreapta, arc, sageata } = require('../compune');
const K = require('./comun');
const P = require('./piept')._ajutor;
const { cadru, curbaDeschisa } = require('../geom');

// Linie punctată de-a lungul corpului (pentru exercițiile statice: corpul rămâne drept).
function linieCorp(a, b) {
  return `<path d="M${a[0].toFixed(1)},${a[1].toFixed(1)}L${b[0].toFixed(1)},${b[1].toFixed(1)}" stroke="#D4FF7A" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="0.1 3.3" fill="none"/>`
    + `<circle cx="${a[0].toFixed(1)}" cy="${a[1].toFixed(1)}" r="1.8" fill="#D4FF7A"/><circle cx="${b[0].toFixed(1)}" cy="${b[1].toFixed(1)}" r="1.8" fill="#D4FF7A"/>`;
}
const pumnPeSol = c => { for (const p of ['aproape', 'departe']) { const m = c.membre[p]; m.mana = cadru(m.antebrat.p(1, 0), 0, 9.5); } return c; };

// Crunch: culcat pe sol, genunchii îndoiți; trunchiul de sus se rulează.
function crunch() {
  const corp = (piept, cap) => L({ bazin: 180, piept, cap, A: { glezna: [34, 4], laba: 0, mana: null, brat: piept + 150, antebrat: piept - 40 }, D: { glezna: [31, 4], laba: 0, brat: piept + 146, antebrat: piept - 44 } });
  const start = corp(180, 178), final = corp(-148, -128);
  return { poze: [
    { corp: start, sol: 12.6 },
    { corp: final, sol: 12.6, sageata: r => arc(add(r.sold, [-10, 0]), 52, 192, 228) },
  ] };
}

function plank() {
  const inc = -8;
  const leg = 180 + inc;
  const c = L({ bazin: inc, piept: inc, cap: inc - 4, A: { brat: 92, antebrat: 0, coapsa: leg, gamba: leg, laba: leg - 95 }, D: { brat: 90, antebrat: -2, coapsa: leg + 1, gamba: leg + 1, laba: leg - 94 } });
  const sol = Math.max(c.membre.aproape.antebrat.p(0.5, 4.6)[1], c.membre.aproape.laba.p(0.96, 4.5)[1]);
  return { poze: [{ corp: pumnPeSol(c), sol, sageata: (r) => linieCorp(add(r.aproape.calcai, [0, -18]), add(r.capVarf, [-2, -12])) }], mini: 0 };
}

function plankLateral() {
  // din față: corpul pe o parte, aproape orizontal, sprijinit pe antebrațul de jos
  const t = -16;
  const leg = 180 + t;
  const c = F({ vedere: 'fata', trunchi: t, st: { brat: -96, antebrat: -100, coapsa: leg - 1, gamba: leg - 1, laba: leg + 10 },
    dr: { brat: 92, bratScara: 0.92, antebrat: 100, antebratScara: 0.32, coapsa: leg + 1.5, gamba: leg + 1.5, laba: leg + 10 } });
  const sol = Math.max(c.membre.dr.mana.p(0.6, 0)[1], c.membre.dr.laba.p(1.1, 0)[1]) + 1;
  return { poze: [{ corp: c, sol, niv: { abdomen: 2, umeri: 1, fese: 1 }, sageata: (r) => linieCorp(add(r.dr.glezna, [-6, -16]), add(r.capVarf, [-4, -10])) }], mini: 0 };
}

function crunchScripete() {
  const corp = (bazin, piept, cap) => L({ bazin, piept, cap, A: { coapsa: 90, gamba: 180, laba: 92, brat: piept - 140, antebrat: piept + 70 }, D: { coapsa: 92, gamba: 182, laba: 92, brat: piept - 144, antebrat: piept + 66 } });
  const start = corp(-82, -84, -82), final = corp(-62, -6, 30);
  const echip = (r, pic, c) => {
    const sol = c.membre.aproape.gamba.p(0.5, -5)[1] + 0.2;
    return E.scripete(pic, { x: 56, yRola: -110, mana: r.aproape.prindere, sol, sus: -122, maner: 'franghie', partea: 1 });
  };
  const solDe = c => c.membre.aproape.gamba.p(0.5, -5)[1] + 0.2;
  return { poze: [
    { corp: start, echip, sol: solDe(start) },
    { corp: final, echip, sol: solDe(final), sageata: r => arc(r.sold, 58, -84, -20) },
  ] };
}

function crunchAparat() {
  const sol = K.SOL_SEZUT;
  const corp = (piept, cap) => K.sezut({ brat: piept + 170, antebrat: piept - 60 }, { brat: piept + 166, antebrat: piept - 64 }, { bazin: -92, piept, cap });
  const start = corp(-94, -88), final = corp(-36, -10);
  const echip = (r, pic, c) => {
    const p = c.piept.p(1.0, 10);
    return [S.scaun(pic, c, sol, { spatar: false, sezutLung: 30 }), E.perna(pic, add(p, [-6, -6]), add(p, [6, 6]), 6, 'sus'),
      E.stalp(pic, [-36, -70], [-36, sol], 5, 'fund'), E.tija(pic, [-36, -40], p, 2.6, 'fund', 'cadru')];
  };
  return { poze: [{ corp: start, echip, sol }, { corp: final, echip, sol, sageata: r => arc(r.sold, 60, -92, -36) }] };
}

function crunchInvers() {
  const corp = (bazin, c, g) => L({ bazin, piept: 180, cap: 178, A: { coapsa: c, gamba: g, laba: g - 80, brat: 4, antebrat: 4 }, D: { coapsa: c + 2, gamba: g + 2, laba: g - 78, brat: 6, antebrat: 6 } });
  const start = corp(180, -86, 2), final = corp(152, -132, -40);
  const sol = 12.6;
  return { poze: [{ corp: start, sol }, { corp: final, sol, sageata: r => arc(r.sold, 46, -70, -130) }] };
}

function ridicariPicioare() {
  const corp = c => P.culcatPlat({ coapsa: c, gamba: c, laba: c - 90, glezna: null, brat: -160, antebrat: 130 }, { coapsa: c - 2, gamba: c - 2, laba: c - 92, glezna: null, brat: -162, antebrat: 128 });
  const fix = c => { for (const p of ['aproape', 'departe']) delete c.membre[p].glezna; return c; };
  const start = fix(corp(-4)), final = fix(corp(-88));
  const echip = (r, pic, c) => S.bancaPlata(pic, c, P.SOL_PLAT, { cap: true });
  return { poze: [{ corp: start, echip, sol: P.SOL_PLAT }, { corp: final, echip, sol: P.SOL_PLAT, sageata: r => arc(r.sold, 70, -8, -84) }] };
}

function rasuciri() {
  // lateral: așezat în V, picioarele ridicate; mâinile trec de pe o parte a șoldului pe cealaltă
  const corp = (mana, cot) => L({ bazin: -128, piept: -124, cap: -110, A: { coapsa: -44, gamba: 34, laba: -30, mana, cot }, D: { coapsa: -42, gamba: 36, laba: -28, mana: add(mana, [-2, 0]), cot } });
  const proba = L({ bazin: -128, piept: -124, A: { brat: 90, antebrat: 90 } });
  const U = proba.umar;
  const a = corp(add(U, [2, 40]), -1), b = corp(add(U, [30, 22]), -1);
  for (const c of [a, b]) c.membre.aproape.bratScara = 0.9;
  const sol = 14;
  return { poze: [
    { corp: a, sol },
    { corp: b, sol, sageata: (r, r0) => sageata([add(r.aproape.prindere, [-30, 22]), add(r.aproape.prindere, [-10, 30]), add(r.aproape.prindere, [8, 14])]) },
  ] };
}

function deadBug() {
  const corp = (brA, cA, gA) => L({ bazin: 180, piept: 180, cap: 178, A: { brat: brA, antebrat: brA, coapsa: -92, gamba: 0, laba: -88 }, D: { brat: -92, antebrat: -92, coapsa: cA, gamba: gA, laba: gA - 90 } });
  const start = corp(-92, -90, 0), final = corp(-178, -8, -6);
  const sol = 12.6;
  return { poze: [{ corp: start, sol }, { corp: final, sol, sageata: r => arc(r.aproape.umar, 40, -92, -170) + arc(r.sold, 50, -88, -12) }] };
}

function pallof() {
  const sol = 92.6;
  const start = K.staF({ mana: [-3, -36], cot: 1, bratScara: 0.8 }, { dr: { mana: [3, -36], cot: -1, bratScara: 0.8 } });
  const final = K.staF({ brat: 40, bratScara: 0.42, antebrat: 30, antebratScara: 0.4 }, { dr: { brat: 140, bratScara: 0.42, antebrat: 150, antebratScara: 0.4 } });
  const echip = (r, pic) => E.scripete(pic, { x: -80, yRola: -34, mana: lerp(r.st.prindere, r.dr.prindere, 0.5), sol, sus: -70, partea: -1, stratCablu: 'fata' });
  return { poze: [{ corp: start, echip, sol }, { corp: final, echip, sol, sageata: (r) => dreapta(add(r.piept, [26, 6]), add(r.piept, [44, 20]), 0) }] };
}

function rollout() {
  const corp = (t, mana) => L({ bazin: t, piept: t, cap: t - 4, A: { coapsa: 92, gamba: 180, laba: 92, mana, cot: 1 }, D: { coapsa: 94, gamba: 182, laba: 92, mana: add(mana, [-2, 0]) } });
  const solDe = c => c.membre.aproape.gamba.p(0.5, -5)[1] + 0.2;
  const proba = t => L({ bazin: t, piept: t, cap: t, A: { coapsa: 92, gamba: 180, brat: 90, antebrat: 90 } });
  const a0 = proba(-50), b0 = proba(-12);
  const sa = solDe(a0), sb = solDe(b0);
  const start = corp(-50, [a0.umar[0] + 4, sa - 20]);
  const final = corp(-12, [b0.umar[0] + 54, sb - 20]);
  const echip = (r, pic) => E.haltera(pic, r.aproape.prindere, 'fund', 20);
  return { poze: [{ corp: start, echip, sol: sa }, { corp: final, echip, sol: sb, sageata: (r, r0) => dreapta(add(r.aproape.prindere, [-60, 28]), add(r.aproape.prindere, [0, 28]), 0) }] };
}

function taietorLemne() {
  const sol = 92.6;
  const picioare = { coapsa: 100, gamba: 90, laba: 98 };
  const corp = (t, mana) => F({ vedere: 'fata', trunchi: t, st: { ...picioare, mana, cot: 1 }, dr: { coapsa: 80, gamba: 90, laba: 82, mana: add(mana, [5, 3]), cot: 1 } });
  const start = corp(-96, [-56, -92]), final = corp(-84, [34, 6]);
  const echip = (r, pic) => E.scripete(pic, { x: -84, yRola: -112, mana: lerp(r.st.prindere, r.dr.prindere, 0.5), sol, sus: -124, partea: -1, stratCablu: 'fata' });
  return { poze: [{ corp: start, echip, sol }, { corp: final, echip, sol, sageata: (r, r0) => sageata([add(r0.st.prindere, [14, 4]), [0, -40], add(r.dr.prindere, [6, -12])]) }] };
}

module.exports = {
  'Crunch': () => crunch(),
  'Plank': () => plank(),
  'Plank lateral': () => plankLateral(),
  'Crunch la scripete, din genunchi': () => crunchScripete(),
  'Crunch la aparat': () => crunchAparat(),
  'Crunch invers': () => crunchInvers(),
  'Ridicări de picioare pe bancă': () => ridicariPicioare(),
  'Răsuciri rusești': () => rasuciri(),
  'Dead bug': () => deadBug(),
  'Pallof press la scripete': () => pallof(),
  'Rollout cu bara': () => rollout(),
  'Tăietorul de lemne la scripete': () => taietorLemne(),
};
