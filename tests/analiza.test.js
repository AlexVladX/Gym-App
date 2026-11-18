// Teste pentru calculele din analiza.js. Rulează cu: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const a = require('../analiza.js');

const sesiune = (data, exercitii) => ({ id: Math.random(), data, exercitii });

test('e1rm folosește formula Epley și întoarce 0 fără repetări', () => {
  assert.equal(a.e1rm(100, 0), 0);
  assert.equal(a.e1rm(100, 1), 100 * (1 + 1 / 30));
  assert.equal(Math.round(a.e1rm(100, 10) * 100) / 100, 133.33);
});

test('recorduriDin găsește greutatea maximă, 1RM estimat și volumul', () => {
  const ist = [
    sesiune('2026-01-01', [{ nume: 'Genuflexiuni', serii: [{ kg: 100, repetari: 5 }, { kg: 100, repetari: 5 }] }]),
    sesiune('2026-01-08', [{ nume: 'genuflexiuni', serii: [{ kg: 105, repetari: 3 }, { kg: 90, repetari: 10 }] }]),
  ];
  const r = a.recorduriDin(ist).get('genuflexiuni');
  assert.equal(r.kg, 105);
  assert.equal(r.kgData, '2026-01-08');
  assert.equal(r.e1rmKg, 90); // 90×10 = 120 > 105×3 = 115.5
  assert.equal(r.volum, 105 * 3 + 900);
});

test('esteRecord: prima dată nu e record; greutate mai mare e record', () => {
  const rec = a.recorduriDin([sesiune('2026-01-01', [{ nume: 'X', serii: [{ kg: 50, repetari: 8 }] }])]);
  assert.equal(a.esteRecord(rec, 'Y', 100, 5), null);
  assert.equal(a.esteRecord(rec, 'x', 52.5, 5), 'greutate');
  assert.equal(a.esteRecord(rec, 'X', 50, 10), 'forta');
  assert.equal(a.esteRecord(rec, 'X', 50, 8), null);
  assert.equal(a.esteRecord(rec, 'X', 50, 0), null);
});

test('esteRecord la exerciții cu greutatea corpului compară repetările', () => {
  const rec = a.recorduriDin([sesiune('2026-01-01', [{ nume: 'Tracțiuni', serii: [{ kg: 0, repetari: 8 }] }])]);
  assert.equal(a.esteRecord(rec, 'Tracțiuni', 0, 9), 'repetari');
  assert.equal(a.esteRecord(rec, 'Tracțiuni', 0, 8), null);
});

test('sugestieProgresie: urcă repetările, apoi greutatea', () => {
  const setari = { minRep: 8, maxRep: 12, pasKg: 2.5 };
  const s1 = a.sugestieProgresie({ serii: [{ kg: 60, repetari: 9 }, { kg: 60, repetari: 8 }] }, setari);
  assert.equal(s1.kg, 60); assert.equal(s1.repetari, 9); assert.equal(s1.crestere, false);
  const s2 = a.sugestieProgresie({ serii: [{ kg: 60, repetari: 12 }, { kg: 60, repetari: 12 }, { kg: 40, repetari: 12 }] }, setari);
  assert.equal(s2.kg, 62.5); assert.equal(s2.repetari, 8); assert.equal(s2.numarSerii, 2); assert.equal(s2.crestere, true);
  assert.equal(a.sugestieProgresie({ serii: [] }, setari), null);
});

test('rezumatSerii formatează seriile', () => {
  assert.equal(a.rezumatSerii([{ kg: 80, repetari: 8 }, { kg: 80, repetari: 8 }]), '2×8 @ 80 kg');
  assert.equal(a.rezumatSerii([{ kg: 80, repetari: 8 }, { kg: 85, repetari: 6 }]), '80×8, 85×6');
  assert.equal(a.rezumatSerii([]), '—');
});

test('seriiPeGrupa numără doar seriile cu repetări și pune restul la Nealocat', () => {
  const grupe = { 'Împins': 'Piept' };
  const r = a.seriiPeGrupa([sesiune('2026-01-01', [
    { nume: 'Împins', serii: [{ kg: 60, repetari: 8 }, { kg: 60, repetari: 0 }] },
    { nume: 'Necunoscut', serii: [{ kg: 10, repetari: 10 }] },
  ])], n => grupe[n] || null);
  assert.deepEqual(r, { Piept: 1, Nealocat: 1 });
});

test('tendintaGreutate calculează media și panta pe săptămână', () => {
  const m = [
    { data: '2026-01-01', valoare: 80 }, { data: '2026-01-04', valoare: 80.3 },
    { data: '2026-01-08', valoare: 80.7 }, { data: '2026-01-11', valoare: 81 },
  ];
  const t = a.tendintaGreutate(m);
  assert.equal(t.ultima, 81);
  assert.ok(Math.abs(t.kgPeSaptamana - 0.7) < 0.05);
  assert.equal(a.tendintaGreutate([]), null);
  assert.equal(a.tendintaGreutate([{ data: '2026-01-01', valoare: 80 }]).kgPeSaptamana, null);
});
