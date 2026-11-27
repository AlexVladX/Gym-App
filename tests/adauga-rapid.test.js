// „+ Adaugă” rapid: masa după oră, „Recente”, copierea unei notări.
const test = require('node:test');
const assert = require('node:assert/strict');
const { masaDupaOra, recenteNutritie, copieIntrareRecenta } = require('../nutritie-zi.js');

const la = (h, m) => new Date(2026, 10, 28, h, m);

test('masa preselectată după oră, cu capetele intervalelor', () => {
  assert.equal(masaDupaOra(la(6, 0)), 'mic-dejun');
  assert.equal(masaDupaOra(la(10, 29)), 'mic-dejun');
  assert.equal(masaDupaOra(la(10, 30)), 'gustare-1');
  assert.equal(masaDupaOra(la(11, 59)), 'gustare-1');
  assert.equal(masaDupaOra(la(12, 0)), 'pranz');
  assert.equal(masaDupaOra(la(15, 29)), 'pranz');
  assert.equal(masaDupaOra(la(15, 30)), 'gustare-2');
  assert.equal(masaDupaOra(la(18, 29)), 'gustare-2');
  assert.equal(masaDupaOra(la(18, 30)), 'cina');
  assert.equal(masaDupaOra(la(23, 59)), 'cina');
  assert.equal(masaDupaOra(la(0, 5)), 'mic-dejun');
});

const v = { kcal: 100, proteine: 5, carbohidrati: 10, grasimi: 3, fibre: 1 };
const zile = [
  { data: '2026-11-27', mese: [
    { id: 'a', masa: 'pranz', idReteta: 'r1', nume: 'Ciorbă', portii: 1, valoriPortie: v, stare: 'complet', adaugat: 100 },
    { id: 'b', masa: 'cina', idReteta: null, nume: 'Măr', portii: 1, valoriPortie: v, stare: 'complet', adaugat: 300, sursa: 'alimente', scanare: { articole: [] } },
  ] },
  { data: '2026-11-28', mese: [
    { id: 'c', masa: 'mic-dejun', idReteta: 'r1', nume: 'Ciorbă', portii: 2, valoriPortie: v, stare: 'neinceput', adaugat: 500 },
    { id: 'd', masa: 'pranz', idReteta: 'r2', nume: 'Paste', portii: 1, valoriPortie: v, stare: 'partial', portiiMancate: 0.5, adaugat: 400, blocat: true },
    { id: 'e', masa: 'pranz', nume: 'Fără valori', adaugat: 900 },
    { id: 'f', masa: 'cina', nume: 'măr', valoriPortie: v, adaugat: 50 },
  ] },
];

test('Recente: cele mai noi întâi, fără dubluri (aceeași rețetă / același nume), fără intrări fără valori', () => {
  const r = recenteNutritie(zile, 5);
  assert.deepEqual(r.map(x => x.id), ['c', 'd', 'b']);
  assert.deepEqual(recenteNutritie(zile, 2).map(x => x.id), ['c', 'd']);
  assert.deepEqual(recenteNutritie([], 5), []);
});

test('copia unei notări: id și masă noi, valorile la fel; rețeta neîncepută, alimentul mâncat', () => {
  const r = copieIntrareRecenta(zile[1].mese[1], { id: 'nou', masa: 'cina', acum: 1000 });
  assert.equal(r.id, 'nou'); assert.equal(r.masa, 'cina'); assert.equal(r.stare, 'neinceput');
  assert.equal(r.portii, 1); assert.deepEqual(r.valoriPortie, v);
  assert.ok(!('blocat' in r) && !('portiiMancate' in r), 'fără blocare și fără porții mâncate copiate');
  assert.equal(r.adaugat, 1000);
  const a = copieIntrareRecenta(zile[0].mese[1], { id: 'n2', masa: 'gustare-1', acum: 2000 });
  assert.equal(a.stare, 'complet'); assert.equal(a.sursa, 'alimente'); assert.deepEqual(a.scanare, { articole: [] });
  assert.equal(zile[0].mese[1].masa, 'cina', 'originalul nu se schimbă');
});
