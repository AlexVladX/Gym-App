// Picioare: cvadricepși, femurali, gambe, fese.
'use strict';
const S = require('../scena');
const { E, L, F, add, sub, mul, lerp } = S;
const { dreapta, arc, sageata } = require('../compune');
const K = require('./comun');
const { dir, cadru } = require('../geom');

const Us = K.umar({ bazin: -90, piept: -90.5 });
const BARA_SPATE = { brat: 130, antebrat: -71, bratScara: 0.78, antebratScara: 0.86 };
const BARA_SPATE_D = { brat: 126, antebrat: -73, bratScara: 0.78, antebratScara: 0.86 };
const solDin = c => Math.max(c.membre.aproape.laba.p(0.3, 6.8)[1], c.membre.departe.laba.p(0.3, 6.8)[1]);

// ---------- genuflexiuni ----------
function genuflexiune(tip) {
  // tip: bara, smith, goblet, frontala, corp
  const jos = { bazin: tip === 'frontala' || tip === 'goblet' ? -58 : -48, cap: tip === 'frontala' ? -78 : -66 };
  jos.piept = jos.bazin - 4;
  const susT = { bazin: -90, piept: -88, cap: -88 };
  const glezna = [26, 50], gleznaD = [23, 50];
  const brate = (t) => {
    if (tip === 'bara' || tip === 'smith') return [BARA_SPATE, BARA_SPATE_D];
    const c = L({ ...t, A: { brat: 90, antebrat: 90 } });
    if (tip === 'goblet') { const p = c.piept.p(0.82, 19); return [{ mana: p, cot: 1 }, { mana: add(p, [-1.5, 0]), cot: 1 }]; }
    if (tip === 'frontala') { const p = c.piept.p(0.95, 16); return [{ mana: p, cot: -1, bratScara: 0.8 }, { mana: add(p, [-1.5, 0]), cot: -1, bratScara: 0.8 }]; }
    const u = c.umar; return [{ mana: add(u, [56, 4]), cot: -1 }, { mana: add(u, [54, 4]), cot: -1 }];
  };
  const [aS, dS] = brate(susT), [aJ, dJ] = brate(jos);
  const start = L({ ...susT, A: { ...K.SEZUT_L, coapsa: 90, gamba: 90, laba: 0, ...aS }, D: { coapsa: 92, gamba: 90, laba: 0, ...dS } });
  const final = L({ ...jos, A: { glezna, laba: 0, ...aJ }, D: { glezna: gleznaD, laba: 0, ...dJ } });
  const echip = (r, pic, c) => {
    const out = [];
    if (tip === 'bara' || tip === 'smith') out.push(E.haltera(pic, r.ceafa, 'fund', tip === 'smith' ? 16 : 20));
    if (tip === 'frontala') out.push(E.haltera(pic, c.piept.p(0.95, 12), 'fund', 20));
    if (tip === 'goblet') out.push(E.gantera(pic, add(r.aproape.prindere, [0, -3]), 90, 'sus', 6));
    if (tip === 'smith') {
      const sol = solDin(c);
      out.push(E.stalp(pic, [r.ceafa[0], r.ceafa[1] - 70], [r.ceafa[0], sol], 3.2, 'fund'), E.stalp(pic, [r.ceafa[0] - 8, sol - 1.6], [r.ceafa[0] + 8, sol - 1.6], 3, 'fund'));
    }
    return out;
  };
  return { poze: [
    { corp: start, echip },
    { corp: final, echip, sageata: (r) => dreapta(add(r.aproape.genunchi, [20, -52]), add(r.aproape.genunchi, [20, -8]), 0) },
  ] };
}

// Hack squat: spatele pe pernă înclinată, umerii sub perne.
function hackSquat() {
  const t = { bazin: -104, piept: -104, cap: -96 };
  const start = L({ ...t, A: { glezna: [22, 84], laba: -14, ...BARA_SPATE }, D: { glezna: [20, 84], laba: -14, ...BARA_SPATE_D } });
  const final = L({ ...t, A: { glezna: [50, 34], laba: -14, ...BARA_SPATE }, D: { glezna: [48, 34], laba: -14, ...BARA_SPATE_D } });
  const echip = (r, pic, c) => {
    const sol = solDin(c);
    const a = c.bazin.p(-0.3, -13.6), b = c.piept.p(1.1, -12.4);
    const talpa = r.aproape.talpa;
    const dirSina = dir(c.piept.unghi);
    const jos = add(talpa, [-20, 6]);
    return [
      E.banda(pic, a, b, 7, { parte: 1, strat: 'fund', raza: 3 }),
      { strat: 'sus', svg: `<circle cx="${r.ceafa[0] + 6}" cy="${r.ceafa[1] - 3}" r="4.6" fill="${pic.lumina(r.ceafa, 4, 'tapiterie')}" stroke="rgba(205,212,220,0.55)" stroke-width="0.6"/>`, puncte: [] },
      E.stalp(pic, add(jos, mul(dirSina, -6)), add(jos, mul(dirSina, 150)), 4.4, 'fund'),
      E.perna(pic, add(talpa, [-14, 2]), add(talpa, [16, -4]), 3.6, 'fund', 1),
      E.stalp(pic, [jos[0] - 10, sol - 1.6], [talpa[0] + 24, sol - 1.6], 3, 'fund'),
    ];
  };
  return { poze: [{ corp: start, echip }, { corp: final, echip, sageata: r => dreapta(add(r.aproape.genunchi, [22, -40]), add(r.aproape.genunchi, [22, 0]), 0) }] };
}

// Presa pentru picioare (45°); varfuri = doar ridicări pe vârfuri.
function presa(varfuri) {
  const t = { bazin: -146, piept: -150, cap: -132 };
  const d = dir(-42);
  const corp = (dist, laba) => {
    const g = mul(d, dist);
    return L({ ...t, A: { glezna: g, laba, brat: 60, antebrat: 20 }, D: { glezna: add(g, [-2.4, 0]), laba, brat: 58, antebrat: 18 } });
  };
  const start = varfuri ? corp(84, -112) : corp(84, -128);
  const final = varfuri ? corp(84, -78) : corp(46, -128);
  const echip = (r, pic, c) => {
    const sol = 52;
    const a = c.bazin.p(-0.25, -13.4), b = c.piept.p(1.1, -12.2);
    const talpa = varfuri ? r.aproape.varf : r.aproape.talpa;
    const n = [d[1], -d[0]];
    const centruPlaca = add(talpa, mul(d, 3));
    return [
      E.banda(pic, b, a, 7, { parte: -1, strat: 'fund', raza: 3 }),
      E.banda(pic, add(a, [-4, 4]), add(a, [24, 12]), 7, { parte: 1, strat: 'fund', raza: 3 }),
      E.stalp(pic, [a[0] - 4, a[1] + 10], [a[0] - 4, sol], 4.4, 'fund'),
      E.stalp(pic, [a[0] - 20, sol - 1.6], [mul(d, 125)[0] + 14, sol - 1.6], 3, 'fund'),
      E.stalp(pic, add(mul(d, 30), [6, 30]), add(mul(d, 125), [6, 30]), 5, 'fund'),
      E.stalp(pic, add(mul(d, 125), [6, 30]), [mul(d, 125)[0] + 6, sol], 4.4, 'fund'),
      E.banda(pic, add(centruPlaca, mul(n, -24)), add(centruPlaca, mul(n, 16)), 4.4, { strat: 'fata', ton: 'cadru', raza: 1.5 }),
    ];
  };
  return { poze: [
    { corp: start, echip, sol: 52 },
    { corp: final, echip, sol: 52, sageata: (r, r0) => varfuri ? arc(r.aproape.glezna, 14, -100, -30)
      : dreapta(add(r0.aproape.talpa, [-6, -16]), add(r.aproape.talpa, [6, -16]), 0) },
  ] };
}

// Extensii pentru cvadricepși / flexii pentru femurali, așezat.
function aparatSezut(tip) {
  const t = { bazin: -98, piept: -96, cap: -90 };
  const sol = K.SOL_SEZUT;
  const unghiuri = tip === 'extensii' ? [90, 4] : [6, 96];
  const corp = g => K.sezut({ gamba: g, laba: g - 90, brat: 104, antebrat: 30 }, { gamba: g + 2, laba: g - 88, brat: 102, antebrat: 28 }, t);
  const echip = (r, pic, c) => {
    const gb = c.membre.aproape.gamba;
    const piv = gb.o;
    const pad = tip === 'extensii' ? gb.p(0.84, -7.4) : gb.p(0.84, 7.6);
    const out = [S.scaun(pic, c, sol, { spatarSus: 1.05, sezutLung: 40 }),
      { strat: 'fata', svg: `<circle cx="${pad[0].toFixed(1)}" cy="${pad[1].toFixed(1)}" r="4.6" fill="${pic.lumina(pad, 4, 'tapiterie')}" stroke="rgba(205,212,220,0.55)" stroke-width="0.6"/>`, puncte: [pad] },
      E.tija(pic, add(piv, [4, 0]), pad, 2.6, 'fata', 'cadru'), E.disc(pic, add(piv, [4, 0]), 3.2, 'fata', 0)];
    if (tip !== 'extensii') {
      const p2 = c.membre.aproape.coapsa.p(0.85, -12);
      out.push({ strat: 'fata', svg: `<circle cx="${p2[0].toFixed(1)}" cy="${p2[1].toFixed(1)}" r="4.4" fill="${pic.lumina(p2, 4, 'tapiterie')}" stroke="rgba(205,212,220,0.55)" stroke-width="0.6"/>`, puncte: [p2] });
    }
    return out;
  };
  return { poze: [
    { corp: corp(unghiuri[0]), echip, sol },
    { corp: corp(unghiuri[1]), echip, sol, sageata: r => arc(r.aproape.genunchi, 40, unghiuri[0] - 6, unghiuri[1] + (tip === 'extensii' ? 6 : -6)) },
  ] };
}

// Flexii pentru femurali, culcat.
function flexiiCulcat() {
  const t = { bazin: 2, piept: 0, cap: -14 };
  const corp = g => L({ ...t, A: { coapsa: 180, gamba: g, laba: g - 70, brat: 72, antebrat: 6 }, D: { coapsa: 182, gamba: g + 2, laba: g - 68, brat: 70, antebrat: 4 } });
  const start = corp(178), final = corp(-62);
  const echip = (r, pic, c) => {
    const y = c.piept.p(0.5, 14.2)[1];
    const sol = y + 6.5 + 40;
    const pad = c.membre.aproape.gamba.p(0.86, 7.6);
    const x0 = c.membre.aproape.coapsa.p(0.92, 0)[0], x1 = c.cap.p(0.9, 0)[0] + 2;
    return [E.banca(pic, [x0, y], [x1, y], sol),
      { strat: 'fata', svg: `<circle cx="${pad[0].toFixed(1)}" cy="${pad[1].toFixed(1)}" r="4.6" fill="${pic.lumina(pad, 4, 'tapiterie')}" stroke="rgba(205,212,220,0.55)" stroke-width="0.6"/>`, puncte: [pad] },
      E.tija(pic, add(c.membre.aproape.gamba.o, [0, 6]), pad, 2.6, 'fund', 'cadru')];
  };
  const solDe = c => c.piept.p(0.5, 14.2)[1] + 46.5;
  return { poze: [
    { corp: start, echip, sol: solDe(start) },
    { corp: final, echip, sol: solDe(final), sageata: r => arc(r.aproape.genunchi, 40, 176, 300) },
  ] };
}

// ---------- fandări ----------
function fandare({ unealta = 'gantere', tip = 'pas' } = {}) {
  // tip: pas (din picioare în fandare), split (fandare pe loc), mers (alternând picioarele)
  const brate = unealta === 'bara' ? [BARA_SPATE, BARA_SPATE_D] : [{ mana: add(Us, [3, 56]), cot: -1 }, { mana: add(Us, [1, 56]), cot: -1 }];
  const fand = (fataAproape = true, adanc = true) => {
    const fata = adanc ? [38, 46] : [32, 70], spate = adanc ? [-40, 40] : [-34, 66];
    const lab = adanc ? 92 : 58;
    const A = fataAproape ? { glezna: fata, laba: 0 } : { glezna: spate, laba: lab };
    const D = fataAproape ? { glezna: add(spate, [-2, 0]), laba: lab } : { glezna: add(fata, [-2, 0]), laba: 0 };
    return L({ bazin: -90, piept: -88, cap: -88, A: { ...A, ...brate[0] }, D: { ...D, ...brate[1], genunchi: -1 } });
  };
  const echip = (r, pic, c) => unealta === 'bara' ? E.haltera(pic, r.ceafa, 'fund', 20)
    : [E.gantera(pic, r.departe.prindere, null, 'spate', 5.8), E.gantera(pic, r.aproape.prindere, null, 'sus', 5.8)];
  const sus = tip === 'pas' ? K.sta(brate[0], brate[1]) : tip === 'split' ? fand(true, false) : fand(false, true);
  const jos = fand(true, true);
  return { poze: [
    { corp: sus, echip },
    { corp: jos, echip, sageata: (r) => tip === 'mers' ? dreapta(add(r.capVarf, [-34, -6]), add(r.capVarf, [26, -6]), 0)
      : dreapta(add(r.sold, [-62, -40]), add(r.sold, [-62, 2]), 0) },
  ] };
}

// Urcări pe bancă cu gantere.
function urcari() {
  const box = 42;
  const start = L({ bazin: -84, piept: -82, cap: -84, A: { glezna: [24, 87 - box - 6], laba: 0, mana: add(Us, [3, 56]), cot: -1 }, D: { glezna: [-16, 82], laba: 0, mana: add(Us, [1, 56]) } });
  const final = K.sta({ mana: add(Us, [3, 56]), cot: -1 }, { mana: add(Us, [1, 56]), coapsa: 30, gamba: 100, laba: 20 });
  const solStart = solDin(start), solFinal = final.membre.aproape.laba.p(0.3, 6.8)[1] + box;
  const echip = s => (r, pic, c) => {
    const x = c.membre.aproape.laba.p(0.3, 0)[0];
    const yBox = s - box;
    return [E.cutie(pic, x - 26, x + 22, yBox, s), E.gantera(pic, r.departe.prindere, null, 'spate', 5.6), E.gantera(pic, r.aproape.prindere, null, 'sus', 5.6)];
  };
  return { poze: [
    { corp: start, echip: echip(solStart), sol: solStart },
    { corp: final, echip: echip(solFinal), sol: solFinal, sageata: r => dreapta(add(r.capVarf, [24, 40]), add(r.capVarf, [24, 2]), 0) },
  ] };
}

// ---------- balamale (îndreptări românești, good morning) ----------
function balama(unealta) {
  const t = unealta === 'goodmorning' ? -6 : -10;
  const g = [12, 84];
  const proba = K.aplecat(t, {}, null, { glezna: g });
  const U = proba.umar;
  const bratFinal = unealta === 'goodmorning' ? BARA_SPATE : { mana: add(U, [2, 56]), cot: -1 };
  const bratFinalD = unealta === 'goodmorning' ? BARA_SPATE_D : { mana: add(U, [0, 56]), cot: -1 };
  const bratStart = unealta === 'goodmorning' ? BARA_SPATE : { mana: add(Us, [5, 56]), cot: -1 };
  const bratStartD = unealta === 'goodmorning' ? BARA_SPATE_D : { mana: add(Us, [3, 56]), cot: -1 };
  const start = K.sta(bratStart, bratStartD);
  const final = K.aplecat(t, { ...bratFinal }, { ...bratFinalD }, { glezna: g, cap: t + 20 });
  const echip = (r, pic) => unealta === 'gantere' ? [E.gantera(pic, r.departe.prindere, null, 'spate', 5.8), E.gantera(pic, r.aproape.prindere, null, 'sus', 5.8)]
    : unealta === 'goodmorning' ? E.haltera(pic, r.ceafa, 'fund', 20) : E.haltera(pic, r.aproape.prindere, 'fund', 20);
  return { poze: [
    { corp: start, echip },
    { corp: final, echip, sageata: r => arc(r.sold, 70, -40, -88) },
  ] };
}

// Îndreptări sumo (din spate, priză îngustă, picioare depărtate).
function sumo() {
  const start = F({ vedere: 'spate', st: { coapsa: 132, coapsaScara: 0.6, gamba: 100, laba: 102, mana: [-10, 44], cot: 1 } });
  const final = F({ vedere: 'spate', st: { coapsa: 112, gamba: 100, laba: 102, mana: [-11, 7], cot: 1 } });
  const echip = (r, pic) => E.halteraFrontala(pic, [0, r.st.prindere[1]], { strat: 'fund', latime: 120 });
  // văzut din spate: femuralii, fesierii și spatele se văd; bara e în fața corpului
  return { poze: [{ corp: start, echip }, { corp: final, echip, sageata: (r) => dreapta(add(r.capVarf, [48, 40]), add(r.capVarf, [48, 4]), 0) }] };
}

// Aparat pentru adductori / abductori (frontal, așezat).
function aparatAdAb(adductori) {
  const larg = { coapsa: 128, coapsaScara: 0.5, gamba: 100, laba: 104 };
  const ingust = { coapsa: 98, coapsaScara: 0.32, gamba: 92, laba: 94 };
  const corp = picioare => K.sezutF({ brat: 100, antebrat: 80, ...picioare });
  const [a, b] = adductori ? [larg, ingust] : [ingust, larg];
  const sol = 58;
  const echip = (r, pic, c) => {
    const T = c.trunchi;
    const out = [E.banda(pic, T.p(-0.05, 0), T.p(1.02, 0), 32, { strat: 'fund', raza: 4 }),
      E.banda(pic, add(T.p(-0.1, 0), [-24, 0]), add(T.p(-0.1, 0), [24, 0]), 9, { strat: 'fund', raza: 3 }),
      E.stalp(pic, [0, 4], [0, sol], 5, 'fund'), E.stalp(pic, [-40, sol - 1.6], [40, sol - 1.6], 3, 'fund')];
    for (const p of ['st', 'dr']) {
      const ext = adductori ? r[p].coapsaInterior : r[p].coapsaExterior;
      out.push(E.perna(pic, add(ext, [0, -9]), add(ext, [0, 9]), 4.4, 'sus'));
    }
    return out;
  };
  return { poze: [
    { corp: corp(a), echip, sol },
    { corp: corp(b), echip, sol, sageata: (r, r0) => dreapta(add(r0.st.genunchi, [0, 10]), add(r.st.genunchi, [0, 10]), 0) + dreapta(add(r0.dr.genunchi, [0, 10]), add(r.dr.genunchi, [0, 10]), 0) },
  ] };
}

// ---------- gambe ----------
function ridicariVarfuri(tip) {
  // tip: aparat (în picioare), gantere, sezut
  const baza = tip === 'sezut' ? null : true;
  const corpCu = laba => {
    if (tip === 'sezut') return K.sezut({ glezna: [44, 34], laba, brat: 80, antebrat: 10 }, { glezna: [41, 34], laba, brat: 78, antebrat: 8 }, { bazin: -94, piept: -92 });
    const brate = tip === 'aparat' ? [{ mana: add(Us, [6, -18]), cot: -1 }, { mana: add(Us, [4, -18]), cot: -1 }] : [{ mana: add(Us, [3, 56]), cot: -1 }, { mana: add(Us, [1, 56]), cot: -1 }];
    return K.sta(brate[0], brate[1]);
  };
  void baza;
  const poza = laba => {
    const c = corpCu(laba);
    // piciorul se rotește în jurul vârfului: corpul urcă; aliniem pe vârf
    for (const parte of ['aproape', 'departe']) {
      const m = c.membre[parte];
      m.laba = cadru(m.laba.o, laba, 24);
    }
    return c;
  };
  // vârful pe marginea treptei; gleznele urcă la final
  const ridica = (c, laba) => {
    const m = c.membre.aproape;
    const varf0 = cadru(m.gamba.p(1, 0), 0, 24).p(0.92, 5.6);
    const lab = cadru(m.gamba.p(1, 0), laba, 24);
    const varf1 = lab.p(0.92, 5.6);
    return sub(varf0, varf1);
  };
  void ridica;
  const start = poza(-16), final = poza(34);
  const echip = (r, pic, c) => {
    const v = r.aproape.varf;
    const sol = v[1] + 13;
    const out = [E.cutie(pic, v[0] - 16, v[0] + 14, v[1] + 0.6, sol)];
    if (tip === 'gantere') out.push(E.gantera(pic, r.departe.prindere, null, 'spate', 5.6), E.gantera(pic, r.aproape.prindere, null, 'sus', 5.6));
    if (tip === 'aparat') {
      out.push({ strat: 'sus', svg: `<circle cx="${(r.ceafa[0] + 8).toFixed(1)}" cy="${(r.ceafa[1] - 5).toFixed(1)}" r="4.8" fill="${pic.lumina(r.ceafa, 4, 'tapiterie')}" stroke="rgba(205,212,220,0.55)" stroke-width="0.6"/>`, puncte: [] },
        E.stalp(pic, [r.ceafa[0] - 26, r.ceafa[1] - 30], [r.ceafa[0] - 26, sol], 5, 'fund'), E.tija(pic, [r.ceafa[0] - 26, r.ceafa[1] - 4], add(r.ceafa, [8, -5]), 3, 'fund', 'cadru'),
        E.stalp(pic, [r.ceafa[0] - 40, sol - 1.6], [v[0] + 20, sol - 1.6], 3, 'fund'));
    }
    if (tip === 'sezut') {
      const g = r.aproape.genunchi;
      out.push({ strat: 'sus', svg: `<circle cx="${(g[0] - 6).toFixed(1)}" cy="${(g[1] - 8).toFixed(1)}" r="4.6" fill="${pic.lumina(g, 4, 'tapiterie')}" stroke="rgba(205,212,220,0.55)" stroke-width="0.6"/>`, puncte: [] },
        S.scaun(pic, c, sol, { spatar: false, sezutLung: 26 }), E.tija(pic, add(g, [-6, -8]), add(g, [20, -8]), 3, 'fund', 'cadru'), E.stalp(pic, add(g, [20, -8]), [g[0] + 20, sol], 4, 'fund'));
    }
    return out;
  };
  const anc = c => c.membre.aproape.laba.p(0.92, 5.6)[1];
  return { poze: [
    { corp: start, echip, ancora: anc(start), sol: anc(start) + 13 },
    { corp: final, echip, ancora: anc(final), sol: anc(final) + 13, sageata: r => dreapta(add(r.aproape.calcai, [-12, 2]), add(r.aproape.calcai, [-12, -14]), 0) },
  ] };
}

// ---------- fese ----------
// Hip thrust (umerii pe bancă) sau pod pe sol (cu bară / pe un picior).
function pod(tip) {
  const peBanca = tip === 'thrust';
  const corp = sus => {
    if (peBanca) {
      const t = sus ? 180 : 214;
      const g = sus ? [44, 38] : [38, 14];
      return L({ bazin: t, piept: t + (sus ? -2 : -6), cap: t + (sus ? -40 : -40), A: { glezna: g, laba: 0, mana: null, brat: sus ? -60 : -40, antebrat: sus ? 30 : 40 }, D: { glezna: add(g, [-2.4, 0]), laba: 0, brat: sus ? -62 : -42, antebrat: sus ? 28 : 38 } });
    }
    const t = sus ? 162 : 180;
    const g = sus ? [36, 20] : [34, 4];
    const unPicior = tip === 'unpicior';
    return L({ bazin: t, piept: t + (sus ? 4 : 0), cap: t + 6,
      A: unPicior ? { coapsa: sus ? -18 : -40, gamba: sus ? -18 : -10, laba: -110, brat: 4, antebrat: 4 } : { glezna: g, laba: 0, brat: tip === 'bara' ? -40 : 4, antebrat: tip === 'bara' ? 30 : 4 },
      D: { glezna: add(g, [-2.4, 0]), laba: 0, brat: tip === 'bara' ? -42 : 6, antebrat: tip === 'bara' ? 28 : 6 } });
  };
  const echip = (r, pic, c) => {
    const out = [];
    if (tip === 'thrust' || tip === 'bara') {
      const bara = c.bazin.p(0.05, 12);
      out.push(E.haltera(pic, add(bara, [0, -2]), 'fund', 20));
    }
    if (peBanca) {
      const sp = c.piept.p(0.78, -12.2);
      const sol = solDin(c);
      out.push(E.banca(pic, [sp[0] - 48, sp[1] + 1], [sp[0] + 4, sp[1] + 1], sol));
    }
    return out;
  };
  return { poze: [
    { corp: corp(false), echip },
    { corp: corp(true), echip, sageata: r => dreapta(add(r.sold, [6, 26]), add(r.sold, [6, -10]), 0) },
  ] };
}

// Kickback la scripete (în picioare, cablul prins de gleznă).
function kickbackScripete() {
  const t = { bazin: -74, piept: -72, cap: -76 };
  const U = K.umar(t);
  const corp = (c, g) => L({ ...t, A: { coapsa: c, gamba: g, laba: g - 90 + 8, mana: add(U, [42, 14]), cot: -1 }, D: { glezna: [6, 86], laba: 0, mana: add(U, [40, 14]), cot: -1 } });
  const start = corp(98, 104), final = corp(140, 146);
  const echip = (r, pic, c) => {
    const sol = c.membre.departe.laba.p(0.3, 6.8)[1];
    return E.scripete(pic, { x: U[0] + 56, yRola: sol - 8, mana: r.aproape.glezna, sol, sus: -60, maner: 'glezna', partea: 1 });
  };
  return { poze: [{ corp: start, echip }, { corp: final, echip, sageata: r => arc(r.sold, 70, 104, 146) }] };
}

// Pull-through la scripete (cu spatele la turn, frânghia printre picioare).
function pullThrough() {
  const t = -16;
  const g = [10, 84];
  const proba = K.aplecat(t, {}, null, { glezna: g });
  const start = K.aplecat(t, { mana: add(proba.membre.aproape.gamba.o, [-8, 4]), cot: -1 }, null, { glezna: g });
  const final = K.sta({ mana: add(Us, [10, 52]), cot: -1 }, { mana: add(Us, [8, 52]) });
  const echip = (r, pic, c) => {
    const sol = solDin(c);
    return E.scripete(pic, { x: -64, yRola: sol - 10, mana: r.aproape.prindere, sol, sus: -60, maner: 'franghie', partea: -1 });
  };
  return { poze: [{ corp: start, echip }, { corp: final, echip, sageata: r => arc(r.sold, 70, -40, -88) }] };
}

// Kickback din patrupedie.
function kickbackPatrupedie() {
  const corp = (c, g) => {
    const p = L({ bazin: 0, piept: -2, cap: -10, A: { coapsa: c, gamba: g, laba: g + 70, brat: 90, antebrat: 90, palma: 'deschisa' }, D: { coapsa: 92, gamba: 180, laba: 182, brat: 92, antebrat: 92, palma: 'deschisa' } });
    for (const parte of ['aproape', 'departe']) { const m = p.membre[parte]; m.mana = cadru(m.antebrat.p(1, 0), 0, 9.5); }
    return p;
  };
  const start = corp(92, 182), final = corp(184, 184);
  const solDe = c => c.membre.departe.gamba.p(0.5, -5.2)[1];
  return { poze: [
    { corp: start, sol: solDe(start) },
    { corp: final, sol: solDe(final), sageata: r => arc(r.sold, 52, 100, 180) },
  ] };
}

module.exports = {
  'Genuflexiuni cu bara': () => genuflexiune('bara'),
  'Genuflexiuni goblet': () => genuflexiune('goblet'),
  'Genuflexiuni la aparatul Smith': () => genuflexiune('smith'),
  'Genuflexiuni frontale': () => genuflexiune('frontala'),
  'Genuflexiuni fără greutăți': () => genuflexiune('corp'),
  'Hack squat la aparat': () => hackSquat(),
  'Presa pentru picioare': () => presa(false),
  'Ridicări pe vârfuri la presă': () => presa(true),
  'Extensii pentru cvadricepși la aparat': () => aparatSezut('extensii'),
  'Flexii pentru femurali, așezat': () => aparatSezut('flexii'),
  'Flexii pentru femurali, culcat': () => flexiiCulcat(),
  'Fandări': () => fandare({ tip: 'pas' }),
  'Genuflexiuni fandate cu gantere (split squat)': () => fandare({ tip: 'split' }),
  'Fandări cu bara': () => fandare({ unealta: 'bara', tip: 'pas' }),
  'Fandări din mers': () => ({ ...fandare({ unealta: 'bara', tip: 'mers' }), mini: 0 }),
  'Urcări pe bancă cu gantere': () => urcari(),
  'Îndreptări cu picioarele întinse, cu gantere': () => balama('gantere'),
  'Îndreptări românești': () => balama('bara'),
  'Good morning cu bara': () => balama('goodmorning'),
  'Îndreptări sumo': () => sumo(),
  'Aparat pentru adductori': () => ({ ...aparatAdAb(true), niv: { adductori: 2, fese: 1, femurali: 1 } }),
  'Aparat pentru abductori': () => aparatAdAb(false),
  'Ridicări pe vârfuri la aparat, în picioare': () => ridicariVarfuri('aparat'),
  'Ridicări pe vârfuri la aparat, așezat': () => ridicariVarfuri('sezut'),
  'Ridicări pe vârfuri cu gantere': () => ridicariVarfuri('gantere'),
  'Hip thrust': () => pod('thrust'),
  'Pod pentru fesieri cu bara': () => pod('bara'),
  'Pod pe un picior': () => pod('unpicior'),
  'Kickback la scripete pentru fesieri': () => kickbackScripete(),
  'Pull-through la scripete': () => pullThrough(),
  'Kickback din patrupedie': () => kickbackPatrupedie(),
};
