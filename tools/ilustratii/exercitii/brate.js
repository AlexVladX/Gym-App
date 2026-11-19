// Brațe: biceps, triceps, antebrațe.
'use strict';
const S = require('../scena');
const { E, L, F, add, mul, lerp } = S;
const { dreapta, arc, sageata } = require('../compune');
const K = require('./comun');
const P = require('./piept')._ajutor;
const { dir, cadru } = require('../geom');

const Us = K.umar({ bazin: -90, piept: -90.5 });
const jos = { brat: 92, antebrat: 88 }, josD = { brat: 89, antebrat: 86 };
const sus = { brat: 97, antebrat: -58 }, susD = { brat: 94, antebrat: -62 };
const arcFlexie = (r) => arc(r.aproape.cot, 32, 82, -50);

// ---------- biceps ----------
function flexiiStand(unealta, { alternativ = false, zottman = false } = {}) {
  const start = K.sta(jos, josD);
  const final = K.sta(sus, alternativ ? josD : susD);
  const echip = (r, pic, c) => {
    if (unealta === 'bara') return E.haltera(pic, r.aproape.prindere, 'fund', 19);
    const ax = unealta === 'ciocan' ? m => c.membre[m].antebrat.unghi - 90 : () => null;
    return [E.gantera(pic, r.departe.prindere, ax('departe'), 'spate', 5.8), E.gantera(pic, r.aproape.prindere, ax('aproape'), 'sus', 5.8)];
  };
  return {
    poze: [{ corp: start, echip }, { corp: final, echip,
      sageata: r => arcFlexie(r) + (zottman ? arc(r.aproape.prindere, 11, 200, 330) : '') }],
  };
}

// Frontal: bara EZ sau bară cu priză inversă; antebrațele vin spre privitor la final.
function flexiiFata(ez) {
  const x = ez ? 13 : 16;
  const start = K.staF({ mana: [-x, 6], cot: 1 });
  const final = K.staF({ brat: 93, antebrat: -92, antebratScara: 0.52 });
  const echip = (r, pic) => E.halteraFrontala(pic, [0, r.st.prindere[1]], { strat: 'sus', ez, latime: 104 });
  return { poze: [{ corp: start, echip }, { corp: final, echip, sageata: (r, r0) => dreapta(add(r0.dr.prindere, [64, 0]), add(r.dr.prindere, [64, 0]), 0) }] };
}

function flexiiScripete(maner) {
  const sol = 93.8;
  const start = K.sta({ ...jos, antebrat: 78 }, { ...josD, antebrat: 76 });
  const final = K.sta(sus, susD);
  const echip = (r, pic) => E.scripete(pic, { x: Us[0] + 60, yRola: 84, mana: r.aproape.prindere, sol, sus: -40, maner, partea: 1 });
  return { poze: [{ corp: start, echip, sol }, { corp: final, echip, sol, sageata: arcFlexie }] };
}

// Pupitru Scott / aparat pentru biceps: brațul sprijinit pe pernă.
function flexiiPupitru(aparat) {
  const trunchi = { bazin: -88, piept: -80, cap: -80 };
  const braz = aparat ? 22 : 52;
  const sol = K.SOL_SEZUT;
  const start = K.sezut({ brat: braz, antebrat: braz + (aparat ? 52 : 34) }, { brat: braz - 2, antebrat: braz + 30 }, trunchi);
  const final = K.sezut({ brat: braz, antebrat: braz - 125 }, { brat: braz - 2, antebrat: braz - 128 }, trunchi);
  const echip = (r, pic, c) => {
    const b = c.membre.aproape.brat;
    const a1 = b.p(0.05, 8), a2 = b.p(1.12, 6.2);
    const out = [S.scaun(pic, c, sol, { spatar: false, sezutLung: 26 }),
      E.perna(pic, a1, a2, 6, 'fata', 1), E.stalp(pic, lerp(a1, a2, 0.6), [lerp(a1, a2, 0.6)[0] + 4, sol], 4, 'fund')];
    if (aparat) {
      const piv = c.membre.aproape.antebrat.o;
      out.push(E.tija(pic, piv, r.aproape.prindere, 2.6, 'fata', 'cadru'), E.disc(pic, piv, 3.4, 'fata', 0), E.gantera(pic, r.aproape.prindere, 0, 'sus', 1.6));
    } else out.push(E.haltera(pic, r.aproape.prindere, 'fund', 16));
    return out;
  };
  return { poze: [{ corp: start, echip, sol }, { corp: final, echip, sol, sageata: r => arc(r.aproape.cot, 30, braz + 40, braz - 110) }] };
}

// Flexii cu gantere pe bancă înclinată (brațele atârnă în spatele trunchiului).
function flexiiInclinat() {
  const t = -118;
  const corp = (A, D) => L({ bazin: t, piept: t, cap: t + 26, A: { glezna: [44, 58], laba: 0, ...A }, D: { glezna: [41, 58], laba: 0, ...D } });
  const echip = (r, pic, c) => [S.bancaInclinata(pic, c, 65), E.gantera(pic, r.departe.prindere, null, 'spate', 5.8), E.gantera(pic, r.aproape.prindere, null, 'sus', 5.8)];
  return { poze: [
    { corp: corp({ brat: 96, antebrat: 92 }, { brat: 93, antebrat: 90 }), echip, sol: 65 },
    { corp: corp({ brat: 98, antebrat: -50 }, { brat: 95, antebrat: -54 }), echip, sol: 65, sageata: arcFlexie },
  ] };
}

// Flexii concentrate: așezat, aplecat, cotul pe interiorul coapsei.
function flexiiConcentrate() {
  const trunchi = { bazin: -62, piept: -52, cap: -40 };
  const sol = K.SOL_SEZUT;
  const corp = A => K.sezut({ coapsa: -2, gamba: 84, ...A }, { brat: 84, antebrat: 120, coapsa: 6, gamba: 96 }, trunchi);
  const echip = (r, pic, c) => [S.scaun(pic, c, sol, { spatar: false, sezutLung: 22 }), E.gantera(pic, r.aproape.prindere, null, 'sus', 5.8)];
  return { poze: [
    { corp: corp({ brat: 84, antebrat: 96 }), echip, sol },
    { corp: corp({ brat: 84, antebrat: -50 }), echip, sol, sageata: r => arc(r.aproape.cot, 32, 92, -40) },
  ] };
}

// Flexii spider: pieptul pe bancă înclinată, brațele verticale.
function flexiiSpider() {
  const t = -42;
  const baza = { bazin: t, piept: t, cap: t + 8 };
  const sol = 74;
  const corp = A => L({ ...baza, A: { glezna: [-14, sol - 7.3], laba: 0, ...A }, D: { glezna: [-17, sol - 7.3], laba: 0 } });
  const echip = (r, pic, c) => {
    const a = c.bazin.p(0.1, 10.4), b = c.piept.p(0.98, 11.5);
    return [E.banda(pic, a, b, 6.5, { parte: 1, raza: 2.6, strat: 'mijloc' }),
      E.tija(pic, lerp(a, b, 0.5), [lerp(a, b, 0.5)[0] + 6, sol], 3.4, 'fund', 'cadru'),
      E.tija(pic, add(a, [2, 6]), [a[0] - 6, sol], 3.4, 'fund', 'cadru'),
      E.tija(pic, [a[0] - 12, sol - 1.4], [lerp(a, b, 0.5)[0] + 14, sol - 1.4], 2.6, 'fund', 'cadru'),
      E.haltera(pic, r.aproape.prindere, 'fund', 14)];
  };
  return { poze: [
    { corp: corp({ brat: 90, antebrat: 92 }), echip, sol },
    { corp: corp({ brat: 92, antebrat: -40 }), echip, sol, sageata: r => arc(r.aproape.cot, 30, 96, -30) },
  ] };
}

// ---------- triceps ----------
function extensiiScripete(maner) {
  const sol = 93.8;
  const trunchi = { bazin: -86, piept: -84, cap: -84 };
  const start = K.sta({ brat: 98, antebrat: -18 }, { brat: 95, antebrat: -21 }, trunchi);
  const final = K.sta({ brat: 97, antebrat: maner === 'franghie' ? 80 : 86 }, { brat: 94, antebrat: 84 }, trunchi);
  const echip = (r, pic) => E.scripete(pic, { x: Us[0] + 46, yRola: -122, mana: r.aproape.prindere, sol, sus: -132, maner, partea: 1 });
  return { poze: [{ corp: start, echip, sol }, { corp: final, echip, sol, sageata: r => arc(r.aproape.cot, 32, -20, 80) }] };
}

function extensiiPrizaInversa() {
  const sol = 92.6;
  const start = K.staF({ brat: 94, antebrat: -90, antebratScara: 0.48 });
  const final = K.staF({ mana: [-13, 6], cot: 1 });
  const echip = (r, pic) => {
    const y = r.st.prindere[1];
    return [E.tija(pic, [-16, y], [16, y], 2.4, 'sus'), { strat: 'spate', svg: `<path d="M0,${y.toFixed(1)}L0,-130" stroke="#BFC6CE" stroke-width="0.9"/>`, puncte: [[0, -130]] }];
  };
  return { poze: [{ corp: start, echip, sol }, { corp: final, echip, sol, sageata: (r, r0) => dreapta(add(r0.dr.prindere, [30, 0]), add(r.dr.prindere, [30, 0]), 0) }] };
}

function extensieDeasupraCapului() {
  const start = K.sta({ brat: -98, antebrat: 104 }, { brat: -100, antebrat: 102 });
  const final = K.sta({ brat: -96, antebrat: -90 }, { brat: -98, antebrat: -92 });
  const echip = (r, pic, c) => {
    const ung = c.membre.aproape.antebrat.unghi;
    return E.gantera(pic, add(r.aproape.prindere, mul(dir(ung), 5)), ung, 'sus', 5.8);
  };
  return { poze: [{ corp: start, echip }, { corp: final, echip, sageata: r => arc(r.aproape.cot, 34, 100, -80) }] };
}

function extensieScripeteDeasupra() {
  const t = -58;
  const corp = A => L({ bazin: t, piept: t + 2, cap: t + 16,
    A: { glezna: [30, 80], laba: 0, ...A }, D: { glezna: [-26, 82], laba: 0, ...A } });
  const echip = (r, pic, c) => {
    const sol = c.membre.aproape.laba.p(0.3, 6.8)[1];
    return E.scripete(pic, { x: -64, yRola: -96, mana: r.aproape.prindere, sol, sus: -108, maner: 'franghie', partea: -1 });
  };
  return { poze: [
    { corp: corp({ brat: -52, antebrat: 160 }), echip },
    { corp: corp({ brat: -50, antebrat: -44 }), echip, sageata: r => arc(r.aproape.cot, 30, 150, 300) },
  ] };
}

function extensiiCulcat(unealta) {
  const corp = (A, D) => P.culcatPlat(A, D);
  const echip = (r, pic, c) => [S.bancaPlata(pic, c, P.SOL_PLAT),
    unealta === 'ez' ? E.haltera(pic, r.aproape.prindere, 'fund', 14)
      : [E.gantera(pic, r.departe.prindere, 0, 'spate', 5.4), E.gantera(pic, r.aproape.prindere, 0, 'sus', 5.4)]];
  return { poze: [
    { corp: corp({ brat: -104, antebrat: 152 }, { brat: -106, antebrat: 150 }), echip, sol: P.SOL_PLAT },
    { corp: corp({ brat: -100, antebrat: -98 }, { brat: -102, antebrat: -100 }), echip, sol: P.SOL_PLAT, sageata: r => arc(r.aproape.cot, 30, 150, 268) },
  ] };
}

// Flotări la paralele.
function paralele() {
  const picioare = { coapsa: 84, gamba: 168, laba: 80 };
  const start = L({ bazin: -88, piept: -86, cap: -84, A: { mana: add(Us, [3, 56]), palma: 'pumn', cot: -1, ...picioare }, D: { coapsa: 80, gamba: 164, laba: 76 } });
  const final = L({ bazin: -76, piept: -74, cap: -72, A: { mana: add(K.umar({ bazin: -76, piept: -74 }), [-4, 30]), cot: -1, ...picioare }, D: { coapsa: 80, gamba: 164, laba: 76 } });
  const echip = (r, pic) => {
    const m = r.aproape.prindere;
    const sol = m[1] + 100;
    return [E.tija(pic, [m[0] - 34, m[1] + 1], [m[0] + 30, m[1] + 1], 3, 'fata'),
      E.stalp(pic, [m[0] - 30, m[1] + 2], [m[0] - 30, sol], 4, 'fund'), E.stalp(pic, [m[0] + 26, m[1] + 2], [m[0] + 26, sol], 4, 'fund'),
      E.stalp(pic, [m[0] - 40, sol - 1.6], [m[0] + 36, sol - 1.6], 3, 'fund')];
  };
  const solDe = c => c.membre.aproape.mana.p(0.5, 0)[1] + 100;
  return { poze: [
    { corp: start, echip, sol: solDe(start) },
    { corp: final, echip, sol: solDe(final), sageata: r => dreapta(add(r.capVarf, [26, 30]), add(r.capVarf, [26, -6]), 0) },
  ] };
}

// Flotări între bănci: mâinile pe bancă în spate, călcâiele pe sol în față.
function flotariBanci() {
  const poz = (sus) => {
    const baza = { bazin: -88, piept: -86, cap: -84 };
    const U = K.umar(baza);
    const mana = sus ? add(U, [-9, 54]) : add(U, [-12, 34]);
    const bancaY = mana[1] + 3.6;
    const sol = bancaY + 45;
    const corp = L({ ...baza, A: { mana, cot: 1, glezna: [72, sol - 8], laba: -10 }, D: { glezna: [69, sol - 8], laba: -10 } });
    return { corp, sol, bancaY };
  };
  const a = poz(true), b = poz(false);
  const echip = p => (r, pic) => E.banca(pic, [r.aproape.prindere[0] - 46, p.bancaY], [r.aproape.prindere[0] + 4, p.bancaY], p.sol);
  return { poze: [
    { corp: a.corp, echip: echip(a), sol: a.sol },
    { corp: b.corp, echip: echip(b), sol: b.sol, sageata: r => dreapta(add(r.sold, [-24, -30]), add(r.sold, [-24, 6]), 0) },
  ] };
}

function dipsAparat() {
  const trunchi = { bazin: -92, piept: -90, cap: -88 };
  const U = K.umar(trunchi);
  const sol = K.SOL_SEZUT;
  const echip = (r, pic, c) => {
    const piv = [U[0] + 40, U[1] - 6];
    return [S.scaun(pic, c, sol, { spatarSus: 1.1 }), E.stalp(pic, [U[0] - 24, -96], [U[0] - 24, sol], 5, 'fund'),
      E.tija(pic, piv, r.aproape.prindere, 3, 'fata', 'cadru'), E.disc(pic, piv, 5, 'fund', 0), E.gantera(pic, r.aproape.prindere, 90, 'sus', 1.6)];
  };
  return { poze: [
    { corp: K.sezut({ mana: add(U, [4, 24]), cot: -1 }, {}, trunchi), echip, sol },
    { corp: K.sezut({ mana: add(U, [8, 55]), cot: -1 }, {}, trunchi), echip, sol, sageata: (r, r0) => dreapta(add(r0.aproape.prindere, [14, 0]), add(r.aproape.prindere, [14, 0]), 0) },
  ] };
}

function kickback() {
  const t = -6;
  const banc = 49.4, sol = banc + 45;
  const baza = { bazin: t, piept: t + 1, cap: t + 12 };
  const U = K.umar(baza);
  const corp = A => {
    const c = L({ ...baza, A: { glezna: [-16, sol - 7.3], laba: 0, ...A },
      D: { coapsa: 92, gamba: 180, laba: 120, mana: [U[0] + 3, banc - 3.6], palma: 'deschisa' } });
    const m = c.membre.departe; m.mana = cadru(m.antebrat.p(1, 0), 0, 9.5);
    return c;
  };
  const echip = (r, pic) => [E.banca(pic, [-46, banc], [U[0] + 18, banc], sol), E.gantera(pic, r.aproape.prindere, null, 'sus', 5.6)];
  return { poze: [
    { corp: corp({ brat: 172, antebrat: 92 }), echip, sol },
    { corp: corp({ brat: 172, antebrat: 176 }), echip, sol, sageata: r => arc(r.aproape.cot, 30, 92, 176) },
  ] };
}

// ---------- antebrațe ----------
function flexiiIncheietura(extensie) {
  if (!extensie) {
    // așezat pe bancă, antebrațele pe coapse, palmele în sus
    const trunchi = { bazin: -70, piept: -60, cap: -50 };
    const sol = K.SOL_SEZUT;
    const corp = mu => K.sezut({ brat: 70, antebrat: 2, manaUnghi: mu }, { brat: 68, antebrat: 0, manaUnghi: mu }, trunchi);
    const echip = (r, pic, c) => [S.scaun(pic, c, sol, { spatar: false, sezutLung: 24 }), E.haltera(pic, r.aproape.prindere, 'fund', 13)];
    return { poze: [
      { corp: corp(58), echip, sol },
      { corp: corp(-48), echip, sol, sageata: r => arc(r.aproape.incheietura, 16, 70, -50) },
    ] };
  }
  // în genunchi lângă bancă, antebrațele pe bancă, palmele în jos
  const t = -60;
  const sol = 40;
  const corp = mu => L({ bazin: -88, piept: t, cap: t + 18, A: { coapsa: 90, gamba: 180, laba: 92, brat: 50, antebrat: 0, manaUnghi: mu }, D: { coapsa: 92, gamba: 182, laba: 92, brat: 48, antebrat: -1, manaUnghi: mu } });
  const echip = (r, pic, c) => {
    const y = c.membre.aproape.antebrat.p(0.5, 4.4)[1];
    const x1 = c.membre.aproape.antebrat.p(0.98, 0)[0];
    return [E.banca(pic, [x1 - 40, y], [x1, y], sol), E.haltera(pic, r.aproape.prindere, 'fund', 13)];
  };
  return { poze: [
    { corp: corp(56), echip, sol },
    { corp: corp(-42), echip, sol, sageata: r => arc(r.aproape.incheietura, 16, 70, -45) },
  ] };
}

function farmersWalk() {
  const stride = (a, b) => K.sta({ mana: add(Us, [2, 56]), coapsa: a[0], gamba: a[1], laba: a[2] }, { mana: add(Us, [0, 56]), coapsa: b[0], gamba: b[1], laba: b[2] }, { piept: -92 });
  const echip = (r, pic) => [E.gantera(pic, r.departe.prindere, 0, 'spate', 7), E.gantera(pic, r.aproape.prindere, 0, 'sus', 7)];
  return { poze: [
    { corp: stride([72, 96, 0], [106, 120, 30]), echip },
    { corp: stride([108, 122, 32], [74, 94, 0]), echip, sageata: r => dreapta(add(r.capVarf, [-30, -8]), add(r.capVarf, [30, -8]), 0) },
  ] };
}

const piept = require('./piept');
module.exports = {
  'Flexii cu bara': () => flexiiStand('bara'),
  'Flexii cu gantere alternativ': () => flexiiStand('gantere', { alternativ: true }),
  'Flexii ciocan': () => flexiiStand('ciocan'),
  'Flexii Zottman': () => flexiiStand('gantere', { zottman: true }),
  'Flexii cu bara EZ': () => flexiiFata(true),
  'Flexii inverse cu bara': () => flexiiFata(false),
  'Flexii la scripete': () => flexiiScripete('bara'),
  'Flexii ciocan la scripete': () => flexiiScripete('franghie'),
  'Flexii la pupitru (Scott)': () => flexiiPupitru(false),
  'Flexii la aparat pentru biceps': () => flexiiPupitru(true),
  'Flexii cu gantere pe bancă înclinată': () => flexiiInclinat(),
  'Flexii concentrate': () => flexiiConcentrate(),
  'Flexii spider': () => flexiiSpider(),
  'Extensii triceps la scripete': () => extensiiScripete('bara'),
  'Extensii triceps la scripete cu frânghie': () => extensiiScripete('franghie'),
  'Extensii triceps la scripete cu bară în V': () => extensiiScripete('v'),
  'Extensii triceps cu priză inversă': () => extensiiPrizaInversa(),
  'Extensii triceps deasupra capului': () => extensieDeasupraCapului(),
  'Extensii triceps deasupra capului la scripete': () => extensieScripeteDeasupra(),
  'Extensii franceze cu bara EZ (skullcrusher)': () => extensiiCulcat('ez'),
  'Extensii triceps culcat cu gantere': () => extensiiCulcat('gantere'),
  'Împins cu priză îngustă': () => piept._ajutor.impinsPlat({ unealta: 'bara', priza: 'ingusta' }),
  'Flotări cu mâinile apropiate': () => piept._ajutor.flotari({ ingust: true }),
  'Flotări la paralele (dips)': () => paralele(),
  'Flotări între bănci': () => flotariBanci(),
  'Dips la aparat': () => dipsAparat(),
  'Kickback cu gantera': () => kickback(),
  'Flexii de încheietură, palmele în sus': () => flexiiIncheietura(false),
  'Extensii de încheietură, palmele în jos': () => flexiiIncheietura(true),
  "Mers cu greutăți (farmer's walk)": () => farmersWalk(),
};
