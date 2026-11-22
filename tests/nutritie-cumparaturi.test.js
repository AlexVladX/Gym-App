// Teste pentru lista de cumpărături (nutritie-cumparaturi.js, etapa 10).
const test = require('node:test');
const assert = require('node:assert/strict');
const l = require('../nutritie-cumparaturi.js');
const z = require('../nutritie-zi.js');
const c = require('../nutritie-calcul.js');
const v = require('../validare.js');
const { ALIMENTE_BAZA } = require('../nutritie-alimente.js');
const { RETETE_BAZA } = require('../nutritie-retete.js');

const idx = c.indexAlimente(ALIMENTE_BAZA);
const R = id => RETETE_BAZA.find(r => r.id === id);
const intrare = (id, r, portii = 1) => z.intrareMasa({ id, masa: r.masa, reteta: r, valoriPortieReteta: c.valoriPortie(r, idx), portii });
const aproape = (x, y, eps = 1e-6) => assert.ok(Math.abs(x - y) < eps, `${x} ≠ ${y}`);

test('ingredientele se adună pe aliment, × porții, doar din mesele neîncepute', () => {
  const pui = R('pr-pui-orez-broccoli'); // 4 porții, 600 g piept de pui
  const zile = [
    { data: '2026-11-23', mese: [intrare('a', pui, 1), intrare('b', pui, 2)] },
    { data: '2026-11-24', mese: [z.schimbaStareIntrare(intrare('c', pui, 1), 'complet')] },
  ];
  const r = l.ingredienteDinZile(zile);
  aproape(r.ingrediente.get('pui-piept').grame, 150 * 3);
  assert.equal(r.ingrediente.get('pui-piept').surse.length, 2);
  assert.equal(r.mese, 2);
  assert.equal(r.excluseMancate, 1);
});

test('cantitățile ajustate în zi se folosesc; intrările vechi fără ingrediente iau rețeta', () => {
  const pui = R('pr-pui-orez-broccoli');
  const ajustat = z.ajusteazaIngredienteIntrare(intrare('a', pui, 1), intrare('a', pui, 1).ingredientePortie.map(([id, g]) => [id, id === 'pui-piept' ? 300 : g]),
    x => c.valoriIngrediente(x, idx));
  const vechi = { ...intrare('b', pui, 1) }; delete vechi.ingredientePortie;
  const sters = { ...intrare('x', pui, 1), idReteta: 'u-sters' }; delete sters.ingredientePortie;
  const r = l.ingredienteDinZile([{ data: '2026-11-23', mese: [ajustat, vechi, sters] }], { retete: RETETE_BAZA });
  aproape(r.ingrediente.get('pui-piept').grame, 300 + 150);
  assert.equal(r.faraIngrediente, 1);
});

test('rotunjirea în sus și bucățile', () => {
  assert.deepEqual([3, 37, 51, 499, 501, 1234].map(l.rotunjesteCumparare), [5, 40, 60, 500, 550, 1250]);
  const ou = idx.get('ou'); // 50 g/buc
  assert.equal(l.textCantitateCumparare(ou, 120), '3 ouă (120 g)');
  assert.equal(l.textCantitateCumparare(ou, 50), '1 ou (50 g)');
  assert.equal(l.textCantitateCumparare(idx.get('pui-piept'), 1234), '1,3 kg');
});

test('lista: categorii, bife, scoase, cantități modificate și planul schimbat, articole proprii', () => {
  const pui = R('pr-pui-orez-broccoli');
  const zile = [{ data: '2026-11-23', mese: [intrare('a', pui, 1)] }];
  const stare = { ...l.stareListaGoala('2026-11-23', '2026-11-23'),
    cumparate: { 'pui-piept': true }, eliminate: { 'ulei-masline': true }, cantitati: { broccoli: { grame: 500, laPlan: 100 } },
    personalizate: [{ id: 'p1', nume: 'Cafea', cantitate: '1 pachet', cat: 'altele', cumparat: false }] };
  const lista = l.construiesteLista({ zile, idx, retete: RETETE_BAZA, stare });
  const toate = lista.categorii.flatMap(k => k.articole);
  const ordine = l.CATEGORII_CUMPARATURI.map(k => k.id);
  assert.deepEqual(lista.categorii.map(k => k.id), [...lista.categorii.map(k => k.id)].sort((a, b) => ordine.indexOf(a) - ordine.indexOf(b)));
  assert.ok(toate.find(a => a.id === 'pui-piept').cumparat);
  assert.equal(lista.categorii.find(k => k.id === 'carne').articole[0].id, 'pui-piept');
  if (pui.ingrediente.some(([id]) => id === 'ulei-masline')) {
    assert.ok(!toate.some(a => a.id === 'ulei-masline'));
    assert.equal(lista.eliminate, 1);
  }
  const br = toate.find(a => a.id === 'broccoli');
  if (br) {
    assert.equal(br.grame, 500);
    assert.ok(br.editat);
    assert.equal(br.planSchimbat, l.rotunjesteCumparare(100) !== l.rotunjesteCumparare(br.grameDinPlan));
  }
  assert.ok(toate.some(a => a.personalizat && a.nume === 'Cafea'));
  assert.equal(lista.total, toate.length);
  assert.equal(lista.cumparate, toate.filter(a => a.cumparat).length);
  const text = l.textLista(lista, 'Lista');
  assert.ok(text.startsWith('Lista') && text.includes('CARNE ȘI PEȘTE') && text.includes('☑ Piept de pui') && text.includes('☐ Cafea — 1 pachet'));
});

test('lista se recalculează când planul se schimbă (bifele rămân pe aliment)', () => {
  const pui = R('pr-pui-orez-broccoli');
  const stare = { ...l.stareListaGoala('2026-11-23', '2026-11-23'), cumparate: { 'pui-piept': true } };
  const inainte = l.construiesteLista({ zile: [{ data: '2026-11-23', mese: [intrare('a', pui, 1)] }], idx, stare });
  const dupa = l.construiesteLista({ zile: [{ data: '2026-11-23', mese: [intrare('a', pui, 2)] }], idx, stare });
  const g = x => x.categorii.flatMap(k => k.articole).find(a => a.id === 'pui-piept').grame;
  aproape(g(dupa), 2 * g(inainte));
  assert.ok(dupa.categorii.flatMap(k => k.articole).find(a => a.id === 'pui-piept').cumparat);
});

test('validare și backup', () => {
  assert.equal(l.curataListaCumparaturi({ de: 'x', pana: '2026-11-23' }), null);
  const cur = l.curataListaCumparaturi({ de: '2026-11-23', pana: '2026-11-29', cumparate: { a: true, b: 'da' }, cantitati: { c: { grame: 10, laPlan: 5 }, d: { grame: -1, laPlan: 1 } },
    personalizate: [{ id: 'p', nume: ' Lapte ', cat: 'necunoscut' }, { id: 'q', nume: '' }] });
  assert.equal(cur.id, '2026-11-23_2026-11-29');
  assert.deepEqual(cur.cumparate, { a: true });
  assert.deepEqual(Object.keys(cur.cantitati), ['c']);
  assert.deepEqual(cur.personalizate, [{ id: 'p', nume: 'Lapte', cantitate: '', cat: 'altele', cumparat: false }]);
  const b = v.valideazaBackup({ versiune: 3, sesiuni: [], exercitii: [], masuratori: [], listeCumparaturi: [cur, { de: 'rau' }] });
  assert.equal(b.date.listeCumparaturi.length, 1);
  assert.equal(b.ignorate, 1);
});
