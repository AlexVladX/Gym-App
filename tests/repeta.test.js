// „Repetă ultimul antrenament”: planul construit din ultima sesiune.
const test = require('node:test');
const assert = require('node:assert/strict');
const { planRepetare, ultimaSesiune } = require('../analiza.js');

const sesiune = {
  data: '2026-11-25', inceput: 1000,
  exercitii: [
    { nume: 'Împins la bancă cu bară', serii: [{ kg: 40, repetari: 10, tip: 'incalzire' }, { kg: 80, repetari: 8 }, { kg: 80, repetari: 7 }, { kg: 60, repetari: 10, tip: 'drop' }] },
    { nume: 'Flotări', tip: 'corp', superset: 'A', serii: [{ kg: 0, repetari: 20 }, { kg: 0, repetari: 15, tip: 'esec' }] },
    { nume: 'Fluturări cu gantere', superset: 'A', serii: [{ kg: 12, repetari: 12 }] },
    { nume: 'Plank', tip: 'timp', serii: [{ durataSec: 60 }] },
  ],
};

test('aceeași ordine, același număr și tip de serii, fără greutăți', () => {
  const p = planRepetare(sesiune);
  assert.deepEqual(p.map(x => x.nume), ['Împins la bancă cu bară', 'Flotări', 'Fluturări cu gantere', 'Plank']);
  assert.deepEqual(p[0].serii, ['incalzire', 'normal', 'normal', 'drop']);
  assert.deepEqual(p[1].serii, ['normal', 'esec']);
  assert.ok(p.every(x => x.serii.every(t => typeof t === 'string')), 'doar tipul seriei, nicio valoare copiată');
  assert.ok(!JSON.stringify(p).includes('"kg"') && !JSON.stringify(p).includes('repetari'), 'fără kg/repetări');
});

test('tipul exercițiului și supersetul se păstrează (greutate implicit)', () => {
  const p = planRepetare(sesiune);
  assert.deepEqual(p.map(x => x.tip), ['greutate', 'corp', 'greutate', 'timp']);
  assert.deepEqual(p.map(x => x.superset), [null, 'A', 'A', null]);
});

test('același exercițiu de două ori → o singură dată, cu seriile adunate; date stricate ignorate', () => {
  const p = planRepetare({ exercitii: [{ nume: 'Genuflexiuni', serii: [{}, {}] }, null, { nume: '' }, { nume: 'genuflexiuni', serii: [{ tip: 'drop' }] }, { nume: 'Abdomene', serii: [] }] });
  assert.deepEqual(p, [
    { nume: 'Genuflexiuni', tip: 'greutate', superset: null, serii: ['normal', 'normal', 'drop'] },
    { nume: 'Abdomene', tip: 'greutate', superset: null, serii: ['normal'] },
  ]);
  assert.deepEqual(planRepetare(null), []);
  assert.deepEqual(planRepetare({}), []);
});

test('ultima sesiune = cea începută cel mai târziu', () => {
  const a = { id: 1, inceput: 5 }, b = { id: 2, inceput: 9 }, c = { id: 3, inceput: 7 };
  assert.equal(ultimaSesiune([a, b, c]), b);
  assert.equal(ultimaSesiune([]), null);
});
