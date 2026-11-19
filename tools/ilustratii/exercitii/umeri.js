// Umeri: împinsuri deasupra capului, ridicări laterale/frontale, fluturări inverse, face pull, ramat vertical.
'use strict';
const S = require('../scena');
const { E, L, F, add, mul } = S;
const { dreapta, arc, sageata } = require('../compune');
const K = require('./comun');
const { dir } = require('../geom');

// Împins cu bara deasupra capului (lateral, în picioare).
function impinsBara() {
  const Us = K.umar({ bazin: -90, piept: -90.5 });
  const start = K.sta({ mana: add(Us, [13, -6]), cot: -1 }, { mana: add(Us, [11, -6]), cot: -1 });
  const final = K.sta({ mana: add(Us, [3, -57]), cot: -1 }, { mana: add(Us, [1, -57]), cot: -1 });
  const echip = (r, pic) => E.haltera(pic, r.aproape.prindere, 'fund');
  return {
    poze: [{ corp: start, echip }, { corp: final, echip, sageata: (r, r0) => dreapta(add(r0.aproape.prindere, [30, -2]), add(r.aproape.prindere, [30, 6]), 0) }],
  };
}

// Împins cu gantere (frontal), în picioare sau așezat; Arnold pornește cu palmele spre tine.
function impinsGantere({ sezut = false, arnold = false } = {}) {
  const fac = sezut ? K.sezutF : K.staF;
  const start = arnold ? fac({ brat: 98, bratScara: 0.42, antebrat: -84, antebratScara: 0.95 }) : fac({ mana: [-36, -60], cot: -1 });
  const final = fac({ mana: [-18, -108], cot: -1 });
  const sol = sezut ? 58 : undefined;
  const echip = (r, pic, c) => {
    const out = [E.gantera(pic, r.st.prindere, 0, 'sus', 5.4), E.gantera(pic, r.dr.prindere, 0, 'sus', 5.4)];
    if (sezut) {
      const T = c.trunchi;
      out.unshift(E.banda(pic, T.p(-0.05, 0), T.p(1.02, 0), 30, { strat: 'fund', raza: 4 }),
        E.banda(pic, add(T.p(-0.12, 0), [-22, 0]), add(T.p(-0.12, 0), [22, 0]), 10, { strat: 'mijloc', raza: 3 }),
        E.stalp(pic, [0, 4], [0, sol], 5, 'fund'), E.stalp(pic, [-30, sol - 1.6], [30, sol - 1.6], 3, 'fund'));
    }
    return out;
  };
  const sag = (r, r0) => dreapta(add(r0.dr.prindere, [16, 0]), add(r.dr.prindere, [16, 4]), 0)
    + (arnold ? arc(add(r0.st.prindere, [0, 0]), 9, 200, 340) : '');
  return { poze: [{ corp: start, echip, sol }, { corp: final, echip, sol, sageata: sag }] };
}

// Împins la aparat (lateral, așezat).
function impinsAparatUmeri() {
  const trunchi = { bazin: -92, piept: -91, cap: -88 };
  const U = K.umar(trunchi);
  const sol = K.SOL_SEZUT;
  const echip = (r, pic, c) => {
    const piv = [U[0] - 26, U[1] - 20];
    return [
      S.scaun(pic, c, sol, { spatarSus: 1.12 }),
      E.stalp(pic, [U[0] - 30, -120], [U[0] - 30, sol], 5, 'fund'),
      E.tija(pic, piv, r.aproape.prindere, 3, 'spate', 'cadru'),
      E.disc(pic, piv, 6, 'fund', 0),
      E.gantera(pic, r.aproape.prindere, 0, 'sus', 1.7),
    ];
  };
  return {
    poze: [
      { corp: K.sezut({ mana: add(U, [12, -10]), cot: -1 }, {}, trunchi), echip, sol },
      { corp: K.sezut({ mana: add(U, [6, -56]), cot: -1 }, {}, trunchi), echip, sol, sageata: (r, r0) => dreapta(add(r0.aproape.prindere, [22, 0]), add(r.aproape.prindere, [22, 4]), 0) },
    ],
  };
}

// Ridicări laterale cu gantere (frontal).
function ridicariLaterale() {
  const start = K.staF({ mana: [-23, 6], cot: -1 });
  const final = K.staF({ mana: [-66, -46], cot: 1, antebratScara: 0.98 });
  const echip = (r, pic) => [E.gantera(pic, r.st.prindere, null, 'sus', 5.6), E.gantera(pic, r.dr.prindere, null, 'sus', 5.6)];
  return { poze: [{ corp: start, echip }, { corp: final, echip, sageata: (r) => arc(r.st.umar, 60, 128, 178) + arc(r.dr.umar, 60, 52, 2) }] };
}

// Ridicări laterale la scripete (un braț, cablul trece prin fața corpului).
function ridicariLateraleScripete() {
  const sol = 92.6;
  const start = K.staF({ mana: [-22, 4], cot: -1 }, { dr: { mana: [-7, 8], cot: 1, bratScara: 0.9 } });
  const final = K.staF({ mana: [-22, 4], cot: -1 }, { dr: { mana: [64, -46], cot: -1 } });
  const echip = (r, pic) => E.scripete(pic, { x: -64, yRola: 84, mana: r.dr.prindere, sol, sus: -110, partea: -1, stratCablu: 'fata' });
  return { poze: [{ corp: start, echip, sol }, { corp: final, echip, sol, sageata: (r) => arc(r.dr.umar, 62, 80, 4) }] };
}

// Ridicări frontale (lateral).
function ridicariFrontale() {
  const Us = K.umar({ bazin: -90, piept: -90.5 });
  const start = K.sta({ mana: add(Us, [8, 56]), cot: -1 });
  const final = K.sta({ mana: add(Us, [57, -2]), cot: -1 });
  const echip = (r, pic) => [E.gantera(pic, r.departe.prindere, null, 'spate', 5.6), E.gantera(pic, r.aproape.prindere, null, 'sus', 5.6)];
  return { poze: [{ corp: start, echip }, { corp: final, echip, sageata: () => arc(Us, 66, 76, 4) }] };
}

// Fluturări inverse cu gantere, aplecat (lateral): brațele se deschid lateral, spre privitor.
function fluturariInverse() {
  const t = -14;
  const U = K.umar({ bazin: t, piept: t + 2 });
  const start = K.aplecat(t, { mana: add(U, [4, 54]), cot: -1 });
  const final = K.aplecat(t, { mana: add(U, [2, 6]), cot: -1, bratScara: 0.42, antebratScara: 0.75 });
  const echip = (r, pic) => [E.gantera(pic, r.departe.prindere, null, 'spate', 5.6), E.gantera(pic, r.aproape.prindere, null, 'sus', 5.6)];
  return { poze: [{ corp: start, echip }, { corp: final, echip, sageata: (r, r0) => dreapta(add(r0.aproape.prindere, [18, 0]), add(r.aproape.prindere, [18, 0]), 0) }] };
}

// Fluturări inverse la aparat (văzut din spate, așezat).
function pecDeckInvers() {
  const sol = 58;
  const start = K.sezutF({ brat: 6, bratScara: 0.3, antebrat: 4, antebratScara: 0.35 }, { vedere: 'spate' });
  const final = K.sezutF({ brat: 182, antebrat: 180 }, { vedere: 'spate' });
  const echip = (r, pic) => {
    const out = [E.stalp(pic, [0, 4], [0, sol], 5, 'fund'), E.stalp(pic, [-30, sol - 1.6], [30, sol - 1.6], 3, 'fund'),
      E.banda(pic, [-22, -4], [22, -4], 10, { strat: 'mijloc', raza: 3 }), E.stalp(pic, [-56, -96], [56, -96], 4.4, 'fund')];
    for (const p of ['st', 'dr']) {
      const m = r[p].prindere;
      out.push(E.tija(pic, add(m, [0, -5]), add(m, [0, 5]), 2.4, 'sus'), E.tija(pic, add(m, [0, -5]), [m[0] * 0.5, -96], 2, 'fund'));
    }
    return out;
  };
  return { poze: [{ corp: start, echip, sol }, { corp: final, echip, sol, sageata: (r) => dreapta(add(r.st.cot, [26, -12]), add(r.st.cot, [-4, -12]), 0) + dreapta(add(r.dr.cot, [-26, -12]), add(r.dr.cot, [4, -12]), 0) }] };
}

// Face pull (lateral, în picioare, frânghie la înălțimea feței).
function facePull() {
  const Us = K.umar({ bazin: -90, piept: -90.5 });
  const sol = 93.8;
  const start = K.sta({ mana: add(Us, [55, -10]), cot: -1 });
  const final = K.sta({ mana: add(Us, [10, -20]), cot: -1, bratScara: 0.85 });
  const echip = (r, pic) => E.scripete(pic, { x: Us[0] + 80, yRola: Us[1] - 12, mana: r.aproape.prindere, sol, sus: -80, maner: 'franghie', partea: 1 });
  return { poze: [{ corp: start, echip, sol }, { corp: final, echip, sol, sageata: (r, r0) => dreapta(add(r0.aproape.prindere, [0, -12]), add(r.aproape.prindere, [6, -12]), 0) }] };
}

// Ramat vertical cu bara (frontal).
function ramatVertical() {
  const start = K.staF({ mana: [-10, 8], cot: -1 });
  const final = K.staF({ mana: [-11, -44], cot: 1 });
  const echip = (r, pic) => E.halteraFrontala(pic, [0, r.st.prindere[1]], { strat: 'sus' });
  return { poze: [{ corp: start, echip }, { corp: final, echip, sageata: (r, r0) => dreapta(add(r0.st.prindere, [-64, -4]), add(r.st.prindere, [-64, 4]), 0) }] };
}

module.exports = {
  'Împins deasupra capului': () => impinsBara(),
  'Împins cu gantere deasupra capului': () => impinsGantere({}),
  'Împins cu gantere din șezut': () => impinsGantere({ sezut: true }),
  'Împins Arnold': () => ({ ...impinsGantere({ arnold: true }), mini: 0 }),
  'Împins la aparat pentru umeri': () => impinsAparatUmeri(),
  'Ridicări laterale': () => ridicariLaterale(),
  'Ridicări laterale la scripete': () => ridicariLateraleScripete(),
  'Ridicări frontale cu gantere': () => ridicariFrontale(),
  'Fluturări inverse cu gantere': () => fluturariInverse(),
  'Fluturări inverse la aparat': () => pecDeckInvers(),
  'Face pull la scripete': () => facePull(),
  'Ramat vertical cu bara': () => ramatVertical(),
};
