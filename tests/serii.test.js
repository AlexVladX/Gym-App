// Teste pentru regulile tipurilor de serii și exerciții (etapa 3). Rulează cu: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const a = require('../analiza.js');

const ses = (data, exercitii) => ({ data, exercitii });

test('încălzirea nu contează la recorduri, serii, sugestii și volum (etapa 5)', () => {
  const s = ses('2026-11-10', [{ nume: 'Împins', serii: [
    { kg: 40, repetari: 10, tip: 'incalzire' }, { kg: 60, repetari: 8 }, { kg: 60, repetari: 8 },
  ] }]);
  assert.deepEqual(a.statisticiSesiune(s), { serii: 2, volum: 960 });
  const r = a.recorduriDin([s]).get('împins');
  assert.equal(r.kg, 60);
  assert.equal(r.volum, 960);
  assert.deepEqual(a.seriiPeGrupa([s], () => 'Piept'), { Piept: 2 });
  // încălzirea mai grea decât recordul nu e record
  const rec = a.recorduriDin([s]);
  assert.equal(a.recordPentruSerie(rec, 'Împins', { kg: 100, repetari: 1, tip: 'incalzire' }), null);
  assert.equal(a.recordPentruSerie(rec, 'Împins', { kg: 62.5, repetari: 5 }), 'greutate');
  // sugestia ignoră încălzirea
  const sug = a.sugestieProgresie({ serii: s.exercitii[0].serii }, { minRep: 8, maxRep: 12, pasKg: 2.5 });
  assert.equal(sug.kg, 60);
  assert.equal(sug.numarSerii, 2);
});

test('drop set și eșec sunt serii de lucru', () => {
  const s = ses('2026-11-10', [{ nume: 'X', serii: [{ kg: 50, repetari: 8, tip: 'esec' }, { kg: 40, repetari: 6, tip: 'drop' }] }]);
  assert.equal(a.statisticiSesiune(s).serii, 2);
  assert.equal(a.tipSerie({ tip: 'ceva' }), 'normal');
  assert.equal(a.tipSerie({}), 'normal');
});

test('serii pe timp: valide, fără volum, record de durată', () => {
  const s1 = ses('2026-11-01', [{ nume: 'Plank', serii: [{ kg: 0, repetari: 0, durataSec: 45 }] }]);
  const s2 = ses('2026-11-05', [{ nume: 'Plank', serii: [{ kg: 0, repetari: 0, durataSec: 60 }, { kg: 0, repetari: 0, durataSec: 30 }] }]);
  assert.equal(a.serieValida(s1.exercitii[0].serii[0]), true);
  assert.deepEqual(a.statisticiSesiune(s2), { serii: 2, volum: 0 });
  const rec = a.recorduriDin([s1]);
  assert.equal(a.recordPentruSerie(rec, 'Plank', { kg: 0, repetari: 0, durataSec: 60 }), 'durata');
  assert.equal(a.recordPentruSerie(rec, 'Plank', { kg: 0, repetari: 0, durataSec: 40 }), null);
  const ev = a.recorduriNoi([s1, s2]);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].tip, 'durata');
  assert.equal(ev[0].durataSec, 60);
  assert.equal(a.recorduriDin([s1, s2]).get('plank').durata, 60);
});

test('serii pe distanță: record de distanță', () => {
  const s1 = ses('2026-11-01', [{ nume: 'Farmer', serii: [{ kg: 30, repetari: 0, distantaM: 40 }] }]);
  const rec = a.recorduriDin([s1]);
  assert.equal(a.recordPentruSerie(rec, 'Farmer', { kg: 30, repetari: 0, distantaM: 50 }), 'distanta');
  assert.equal(a.formatSerie({ kg: 30, repetari: 0, distantaM: 40 }), '30 kg × 40 m');
});

test('formatSerie și rezumatSerii pentru toate tipurile', () => {
  assert.equal(a.formatSerie({ kg: 80, repetari: 8 }), '80×8');
  assert.equal(a.formatSerie({ kg: 0, repetari: 12 }), '12');
  assert.equal(a.formatSerie({ kg: 0, repetari: 0, durataSec: 45 }), '45 s');
  assert.equal(a.rezumatSerii([{ kg: 0, repetari: 0, durataSec: 45 }, { kg: 0, repetari: 0, durataSec: 45 }]), '2 × 45 s');
  assert.equal(a.rezumatSerii([{ kg: 40, repetari: 10, tip: 'incalzire' }, { kg: 80, repetari: 8 }, { kg: 80, repetari: 8 }]), '2×8 @ 80 kg (+1 încălz.)');
  assert.equal(a.rezumatSerii([{ kg: 80, repetari: 8 }]), '80×8');
});

test('durataActiva scade pauzele, inclusiv pe cea în curs', () => {
  const min = 60000;
  assert.equal(a.durataActiva(0, 60 * min), 60 * min);
  assert.equal(a.durataActiva(0, 60 * min, [{ start: 10 * min, sfarsit: 20 * min }]), 50 * min);
  assert.equal(a.durataActiva(0, 60 * min, [{ start: 10 * min, sfarsit: 20 * min }], 50 * min), 40 * min);
  assert.equal(a.durataActiva(0, 60 * min, [], 70 * min), 60 * min);
  assert.equal(a.durataSesiuneMin({ inceput: 0, sfarsit: 90 * min, durataActivaMs: 45 * min }), 45);
  assert.equal(a.durataSesiuneMin({ inceput: 0, sfarsit: 30 * min }), 30);
  assert.equal(a.durataSesiuneMin({}), null);
});
