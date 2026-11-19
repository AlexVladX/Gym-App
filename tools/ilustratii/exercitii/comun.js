// Poziții de bază refolosite: în picioare, aplecat, așezat (lateral și frontal).
'use strict';
const S = require('../scena');
const { E, L, F, PICIOARE, PICIOARE_D, add } = S;
const G = require('../geom');

// În picioare, lateral. A/D: membrele (fără picioare, care sunt drepte implicit).
function sta(A = {}, D, trunchi = {}) {
  return L({ bazin: -90, piept: -90.5, cap: -88, ...trunchi,
    A: { ...PICIOARE, ...A }, D: { ...PICIOARE_D, ...(D || {}) } });
}
// Umărul pentru o poziție a trunchiului (lateral).
function umar(trunchi) {
  const b = trunchi.bazin ?? -90, p = trunchi.piept ?? b;
  return L({ bazin: b, piept: p, A: { brat: 90, antebrat: 90 } }).umar;
}
// Aplecat din șold (lateral): trunchiul la unghiul t (−90 vertical, 0 orizontal spre dreapta).
// Genunchii ușor îndoiți, tălpile sub centrul de greutate.
function aplecat(t, A = {}, D, { glezna = null, cap } = {}) {
  const g = glezna || [6 + (90 + t) * 0.16, 84 - (90 + t) * 0.06];
  return L({ bazin: t, piept: t + 2, cap: cap ?? t + 14,
    A: { glezna: g, laba: 0, ...A }, D: { glezna: add(g, [-2.5, 0]), laba: 0, ...(D || {}) } });
}
// Frontal, în picioare.
const PICIOARE_F = { coapsa: 95, gamba: 91, laba: 94 };
function staF(st = {}, extra = {}) { return F({ vedere: 'fata', ...extra, st: { ...PICIOARE_F, ...st } }); }
// Așezat, frontal (coapsele spre privitor).
const SEZUT_F = { coapsa: 96, coapsaScara: 0.2, gamba: 91, laba: 92 };
function sezutF(st = {}, extra = {}) { return F({ vedere: 'fata', ...extra, st: { ...SEZUT_F, ...st } }); }
// Așezat lateral pe un scaun de înălțime normală: coapsele orizontale, gambele verticale.
const SEZUT_L = { coapsa: 2, gamba: 90, laba: 0 };
const SEZUT_L_D = { coapsa: 4, gamba: 92, laba: 0 };
function sezut(A = {}, D, trunchi = {}) {
  return L({ bazin: -92, piept: -91, cap: -88, ...trunchi, A: { ...SEZUT_L, ...A }, D: { ...SEZUT_L_D, ...(D || {}) } });
}
const SOL_SEZUT = 13 + 7 + 45;

// Rama unui aparat cu greutăți: stâlp vertical, braț de pârghie până la mâner.
function stalpAparat(pic, x, sus, sol) {
  return [E.stalp(pic, [x, sus], [x, sol], 5.2, 'fund'), E.stalp(pic, [x - 14, sol - 1.6], [x + 14, sol - 1.6], 3, 'fund')];
}

module.exports = { sta, umar, aplecat, staF, sezutF, sezut, PICIOARE_F, SEZUT_F, SEZUT_L, SOL_SEZUT, stalpAparat, G };
