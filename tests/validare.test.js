// Teste pentru validarea backupurilor (validare.js). Rulează cu: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const { valideazaBackup } = require('../validare.js');

const backupV2 = () => ({
  versiune: 2,
  exportat: '2026-11-01T10:00:00.000Z',
  sesiuni: [{ id: 1, data: '2026-10-30', inceput: 1, sfarsit: 2, grupe: ['Piept'], exercitii: [{ nume: 'Împins', serii: [{ kg: 60, repetari: 8 }] }] }],
  exercitii: [{ nume: 'Împins', grupa: 'Piept' }],
  masuratori: [{ id: 1, data: '2026-10-30', tip: 'Greutate', valoare: 80, creat: 1 }],
  rutine: [{ id: 1, nume: 'Piept', grupe: ['Piept'], exercitii: ['Împins'], creat: 1 }],
});

test('acceptă un backup v2 valid fără modificări de conținut', () => {
  const r = valideazaBackup(backupV2());
  assert.equal(r.ok, true);
  assert.equal(r.ignorate, 0);
  assert.deepEqual(r.date.sesiuni, backupV2().sesiuni);
  assert.deepEqual(r.date.rutine, backupV2().rutine);
  assert.equal(r.rezumat.sesiuni, 1);
});

test('respinge ce nu e backup', () => {
  for (const brut of [null, 42, 'text', [], {}, { sesiuni: [] }]) {
    const r = valideazaBackup(brut);
    assert.equal(r.ok, false);
    assert.ok(r.eroare.length > 10);
  }
});

test('respinge un backup dintr-o versiune viitoare', () => {
  const b = backupV2(); b.versiune = 99;
  assert.equal(valideazaBackup(b).ok, false);
});

test('ignoră înregistrările stricate și le numără', () => {
  const b = backupV2();
  b.sesiuni.push({ id: 2, exercitii: [] });                 // fără dată
  b.sesiuni.push({ id: 3, data: '30.10.2026', exercitii: [] }); // dată în alt format
  b.sesiuni.push(null);
  b.masuratori.push({ data: '2026-10-31', tip: 'Talie', valoare: 'abc' });
  b.exercitii.push({ grupa: 'Spate' });
  const r = valideazaBackup(b);
  assert.equal(r.ok, true);
  assert.equal(r.ignorate, 5);
  assert.equal(r.date.sesiuni.length, 1);
  assert.equal(r.date.masuratori.length, 1);
});

test('respinge un fișier în care nimic nu poate fi citit', () => {
  const r = valideazaBackup({ sesiuni: [{}, {}], exercitii: [], masuratori: [] });
  assert.equal(r.ok, false);
});

test('curăță seriile: transformă textul în numere și scoate valorile imposibile', () => {
  const b = backupV2();
  b.sesiuni[0].exercitii[0].serii = [{ kg: '62.5', repetari: '8' }, { kg: -5, repetari: 8 }, { kg: 60, repetari: 8, tip: 'incalzire' }];
  const serii = valideazaBackup(b).date.sesiuni[0].exercitii[0].serii;
  assert.deepEqual(serii, [{ kg: 62.5, repetari: 8 }, { kg: 60, repetari: 8, tip: 'incalzire' }]);
});

test('scoate id-urile duplicate ca baza să dea altele noi', () => {
  const b = backupV2();
  b.sesiuni.push({ ...b.sesiuni[0] });
  const r = valideazaBackup(b);
  assert.equal(r.date.sesiuni[0].id, 1);
  assert.equal('id' in r.date.sesiuni[1], false);
});

test('backup fără rutine nu cere ștergerea rutinelor', () => {
  const b = backupV2(); delete b.rutine;
  const r = valideazaBackup(b);
  assert.equal('rutine' in r.date, false);
  assert.equal(r.rezumat.rutine, null);
});

test('păstrează setările din backupul v3', () => {
  const b = { ...backupV2(), versiune: 3, setari: { minRep: 6, maxRep: 10 } };
  assert.deepEqual(valideazaBackup(b).date.setari, { minRep: 6, maxRep: 10 });
});
