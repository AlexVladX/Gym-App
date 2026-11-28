// Faza 2: logica sincronizării (amprente, ce se trimite, combinare, conflicte).
const test = require('node:test');
const assert = require('node:assert/strict');
const s = require('../sincron.js');
const D = s.DEF_SINCRON;

test('JSON stabil și amprentă: ordinea cheilor nu contează', () => {
  assert.equal(s.jsonStabil({ b: 1, a: [1, { d: 2, c: 3 }] }), s.jsonStabil({ a: [1, { c: 3, d: 2 }], b: 1 }));
  assert.equal(s.amprenta('abc'), s.amprenta('abc'));
  assert.notEqual(s.amprenta('abc'), s.amprenta('abd'));
  assert.match(s.amprenta('x'), /^[0-9a-f]{14}$/);
});

test('uid din conținut: aceeași înregistrare pe două telefoane (id-uri locale diferite) → același uid', () => {
  const a = { id: 3, data: '2026-11-20', exercitii: [{ nume: 'Genuflexiuni', serii: [{ kg: 80, repetari: 5 }] }] };
  const b = { id: 17, exercitii: [{ serii: [{ repetari: 5, kg: 80 }], nume: 'Genuflexiuni' }], data: '2026-11-20' };
  assert.equal(s.uidDinContinut(a), s.uidDinContinut(b));
  assert.notEqual(s.uidDinContinut(a), s.uidDinContinut({ ...a, data: '2026-11-21' }));
});

test('forma din cloud: fără cheia locală; setările fără ce ține de dispozitiv', () => {
  const r = s.dateCloud(D.sesiuni, { id: 5, uid: 'u1', data: '2026-11-20' }, 'cont');
  assert.deepEqual(r, { uid: 'u1', data: '2026-11-20' });
  const st = s.dateCloud(D.setari, { mod: 'mealprep', ecranAprins: true, minRep: 8 }, 'cont');
  assert.deepEqual(st, { minRep: 8 });
});

test('ce se trimite: nou, modificat, șters; nu ce e neschimbat sau blocat', () => {
  const loc = d => ({ date: d, amprenta: s.amprentaCloud(d) });
  const locale = new Map([['a', loc({ v: 1 })], ['b', loc({ v: 2 })], ['c', loc({ v: 3 })], ['x', loc({ v: 9 })]]);
  const harta = new Map([
    ['a', { amprenta: s.amprentaCloud({ v: 1 }), versiune: 3 }], // neschimbat
    ['b', { amprenta: s.amprentaCloud({ v: 1 }), versiune: 2 }], // modificat
    ['d', { amprenta: 'z', versiune: 7 }],                       // șters local
    ['e', { amprenta: 'z', versiune: 1, sters: true }],         // deja șters peste tot
  ]);
  const lot = s.deTrimis(locale, harta, new Set(['x']));
  const pe = Object.fromEntries(lot.map(x => [x.cheie, x]));
  assert.deepEqual(Object.keys(pe).sort(), ['b', 'c', 'd']);
  assert.equal(pe.b.baza, 2); assert.equal(pe.c.baza, null); assert.equal(pe.d.sters, true); assert.equal(pe.d.baza, 7);
});

test('rând din cloud peste înregistrare neschimbată local → se aplică; versiune veche → se ignoră', () => {
  const baza = { data: '2026-11-20', nota: 'a' };
  const h = { amprenta: s.amprentaCloud(baza), versiune: 2, baza };
  assert.equal(s.decideRand(D.sesiuni, { versiune: 3, date: { ...baza, nota: 'b' } }, baza, h).actiune, 'aplica');
  assert.equal(s.decideRand(D.sesiuni, { versiune: 2, date: { ...baza, nota: 'b' } }, baza, h).actiune, 'ignora');
  assert.equal(s.decideRand(D.sesiuni, { versiune: 3, sters: true, date: null }, baza, h).actiune, 'aplica');
});

test('modificări în ambele părți pe câmpuri diferite → se combină; pe același câmp → conflict', () => {
  const baza = { data: '2026-11-20', nota: 'a', grupe: ['Piept'] };
  const h = { amprenta: s.amprentaCloud(baza), versiune: 1, baza };
  const local = { ...baza, nota: 'aici' };
  const r1 = s.decideRand(D.sesiuni, { versiune: 2, date: { ...baza, grupe: ['Spate'] } }, local, h);
  assert.equal(r1.actiune, 'combina');
  assert.deepEqual(r1.date, { data: '2026-11-20', nota: 'aici', grupe: ['Spate'] });
  const r2 = s.decideRand(D.sesiuni, { versiune: 2, date: { ...baza, nota: 'acolo' } }, local, h);
  assert.equal(r2.actiune, 'conflict');
  assert.deepEqual(r2.campuri, ['nota']);
});

test('șters într-o parte și modificat în cealaltă → conflict (nu se pierde nimic în tăcere)', () => {
  const baza = { data: '2026-11-20', nota: 'a' };
  const h = { amprenta: s.amprentaCloud(baza), versiune: 1, baza };
  assert.equal(s.decideRand(D.sesiuni, { versiune: 2, sters: true, date: null }, { ...baza, nota: 'b' }, h).actiune, 'conflict');
  assert.equal(s.decideRand(D.sesiuni, { versiune: 2, date: { ...baza, nota: 'c' } }, null, h).actiune, 'conflict');
});

test('zi de nutriție: mese adăugate pe dispozitive diferite se adună; aceeași masă schimbată diferit → conflict', () => {
  const m = (id, nume, stare = 'neinceput') => ({ id, masa: 'pranz', nume, stare });
  const baza = { data: '2026-11-22', mese: [m('1', 'Supă')] };
  const h = { amprenta: s.amprentaCloud(baza), versiune: 1, baza };
  const local = { ...baza, mese: [m('1', 'Supă'), m('2', 'Salată')] };
  const server = { ...baza, mese: [m('1', 'Supă', 'complet'), m('3', 'Iaurt')] };
  const r = s.decideRand(D.zileNutritie, { versiune: 2, date: server }, local, h);
  assert.equal(r.actiune, 'combina');
  assert.deepEqual(r.date.mese.map(x => [x.id, x.stare]).sort(), [['1', 'complet'], ['2', 'neinceput'], ['3', 'neinceput']]);
  const local2 = { ...baza, mese: [m('1', 'Supă', 'partial')] };
  assert.equal(s.decideRand(D.zileNutritie, { versiune: 2, date: server }, local2, h).actiune, 'conflict');
});

test('lista de cumpărături: bife de pe două telefoane se adună', () => {
  const baza = { id: 'x', de: 'a', pana: 'b', cumparate: {}, eliminate: {}, cantitati: {}, personalizate: [] };
  const h = { amprenta: s.amprentaCloud(baza), versiune: 1, baza };
  const r = s.decideRand(D.listeCumparaturi, { versiune: 2, date: { ...baza, cumparate: { ou: true } } }, { ...baza, cumparate: { lapte: true } }, h);
  assert.equal(r.actiune, 'combina');
  assert.deepEqual(r.date.cumparate, { lapte: true, ou: true });
});

test('prima legare (fără bază): identice → aplică; doar într-o parte → se păstrează; diferite → conflict', () => {
  const a = { id: 'r1', nume: 'Supă', kcal: 100 };
  assert.equal(s.decideRand(D.retete, { versiune: 1, date: a }, a, undefined).actiune, 'aplica');
  const r = s.decideRand(D.retete, { versiune: 1, date: { ...a, nota: 'x' } }, a, undefined);
  assert.equal(r.actiune, 'combina'); assert.equal(r.date.nota, 'x');
  assert.equal(s.decideRand(D.retete, { versiune: 1, date: { ...a, kcal: 200 } }, a, undefined).actiune, 'conflict');
});

test('marca de timp „modificat” diferită pe două dispozitive nu e conflict: se păstrează cea mai recentă', () => {
  const baza = { data: '2026-11-22', mese: [{ id: '1', nume: 'Supă', stare: 'neinceput' }], modificat: 100 };
  const h = { amprenta: s.amprentaCloud(baza), versiune: 1, baza };
  const local = { ...baza, mese: [...baza.mese, { id: '2', nume: 'Salată', stare: 'neinceput' }], modificat: 300 };
  const server = { ...baza, mese: [{ id: '1', nume: 'Supă', stare: 'complet' }], modificat: 200 };
  const r = s.decideRand(s.DEF_SINCRON.zileNutritie, { versiune: 2, date: server }, local, h);
  assert.equal(r.actiune, 'combina');
  assert.equal(r.date.modificat, 300);
  assert.deepEqual(r.date.mese.map(m => [m.id, m.stare]), [['1', 'complet'], ['2', 'neinceput']]);
});

// Etapa 6: marja de rev — din rândurile ușoare se aduc doar cele pe care telefonul nu le are.
test('randuriDeAdus: doar ce lipsește sau e mai nou, fără dubluri, în ordinea rev', () => {
  const { randuriDeAdus } = require('../sincron.js');
  const harta = new Map([
    ['sesiuni|a', { versiune: 3 }],
    ['sesiuni|b', { versiune: 1 }],
  ]);
  const r = randuriDeAdus([
    { colectie: 'sesiuni', cheie: 'a', versiune: 3, rev: 10 }, // știut
    { colectie: 'sesiuni', cheie: 'a', versiune: 2, rev: 5 },  // mai vechi decât ce știm
    { colectie: 'sesiuni', cheie: 'b', versiune: 2, rev: 12 }, // mai nou
    { colectie: 'sesiuni', cheie: 'c', versiune: 1, rev: 8 },  // lipsește (salvarea întârziată)
    { colectie: 'sesiuni', cheie: 'c', versiune: 1, rev: 8 },  // dublură
    { colectie: 'necunoscuta', cheie: 'x', versiune: 1, rev: 9 },
    null,
  ], harta);
  assert.deepEqual(r.map(x => `${x.cheie}@${x.rev}`), ['c@8', 'b@12']);
  assert.deepEqual(randuriDeAdus([], harta), []);
});
