// Scene folosite de mai multe exerciții: culcat pe bancă, bănci sub corp, aparate de bază.
'use strict';
const E = require('./echipament');
const { L, F, PICIOARE, PICIOARE_D } = require('./baza');
const { add, sub, mul, lerp, dist, unghi } = require('./geom');

const INALTIME_BANCA = 45;

// Pernă de-a lungul spatelui (de la fese până sub cap), pentru poziții culcat pe spate.
// tCap: cât se extinde spre cap (în fracții din piept).
function pernaSpate(pic, corp, { tCap = 1.45, tFese = -0.42, gros = 6.5, strat = 'fund', departare = 0.4 } = {}) {
  const a = corp.bazin.p(tFese, -corp.bazin.L * 0 - 12.9 - departare);
  const b = corp.piept.p(tCap, -11.2 - departare);
  return E.banda(pic, a, b, gros, { parte: -1, strat, raza: 2.6 });
}

// Bancă plată sub o persoană culcată pe spate (trunchi orizontal, capul la stânga).
function bancaPlata(pic, corp, sol, { cap = true, strat = 'fund' } = {}) {
  const yTop = Math.max(corp.bazin.p(0, -12.9)[1], corp.piept.p(0.5, -11.8)[1]) + 0.2;
  const xCap = corp.cap.p(0.9, 0)[0] - (cap ? 4 : -14);
  const xFese = corp.bazin.p(-0.45, 0)[0] + 6;
  return E.banca(pic, [Math.min(xCap, xFese), yTop], [Math.max(xCap, xFese), yTop], sol, { strat });
}

// Bancă înclinată sub o persoană culcată pe spate cu trunchiul înclinat (capul sus-stânga).
// Spătarul urmează spatele, șezutul e orizontal sub fese.
function bancaInclinata(pic, corp, sol, { strat = 'fund', sezutLung = 30 } = {}) {
  const spA = corp.bazin.p(-0.15, -13.6);
  const spB = corp.piept.p(1.32, -11.6);
  const sezY = corp.bazin.p(-0.3, -13)[1] + 0.4;
  const sezA = [spA[0] - 6, sezY], sezB = [spA[0] + sezutLung, sezY];
  const out = [
    E.banda(pic, spB, add(spA, [3, 4]), 6.5, { parte: 1, strat, raza: 2.6 }),
    E.banda(pic, sezA, sezB, 6.5, { parte: 1, strat, raza: 2.6 }),
  ];
  const baza = [sezA[0] + 8, sol];
  out.push(E.tija(pic, lerp(spB, spA, 0.45), baza, 3.2, strat, 'cadru'));
  out.push(E.tija(pic, [sezB[0] - 6, sezY + 6], [sezB[0] - 6, sol], 3.4, strat, 'cadru'));
  out.push(E.tija(pic, [Math.min(spB[0], baza[0]) - 4, sol - 1.4], [sezB[0] + 2, sol - 1.4], 2.6, strat, 'cadru'));
  return out;
}

// Scaun cu spătar (aparate, împins din șezut): șezut sub fese, spătar de-a lungul spatelui.
function scaun(pic, corp, sol, { spatar = true, strat = 'fund', sezutLung = 34, spatarSus = 1.05 } = {}) {
  const sezY = corp.bazin.p(-0.3, -13)[1] + 0.4;
  const x0 = corp.bazin.p(-0.15, -13)[0];
  const out = [E.banda(pic, [x0 - 8, sezY], [x0 + sezutLung, sezY], 7, { parte: 1, strat, raza: 2.8 })];
  if (spatar) {
    const a = corp.bazin.p(0.1, -13.6), b = corp.piept.p(spatarSus, -12.2);
    out.push(E.banda(pic, b, a, 7, { parte: 1, strat, raza: 2.8 }));
    out.push(E.tija(pic, lerp(a, b, 0.3), [a[0] - 4, sezY + 7], 3.2, strat, 'cadru'));
  }
  out.push(E.tija(pic, [x0 + sezutLung / 2 - 6, sezY + 7], [x0 + sezutLung / 2 - 6, sol], 4.4, strat, 'cadru'));
  out.push(E.tija(pic, [x0 - 14, sol - 1.6], [x0 + sezutLung + 6, sol - 1.6], 3, strat, 'cadru'));
  return out;
}

// Picioare sprijinite pe sol (culcat pe bancă): glezna la (x, sol − 7.5)
const talpaPe = (x, sol) => [x, sol - 7.6];

module.exports = { INALTIME_BANCA, pernaSpate, bancaPlata, bancaInclinata, scaun, talpaPe, E, L, F, PICIOARE, PICIOARE_D, add, sub, mul, lerp, dist, unghi };
