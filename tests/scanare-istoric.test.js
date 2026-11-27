// Scanarea meselor, etapa 4: istoricul (validare, căutare, comparare), păstrarea pozelor, limita ta și costul estimat.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../scanare-istoric.js');

const art = (nume, kcal) => ({ nume, cantitate: 100, unitate: 'g', grame: 100, estimat: true, valori: { kcal, proteine: 10, carbohidrati: 5, grasimi: 2, fibre: 1 }, sursa: { tip: 'usda', eticheta: 'USDA', nume: 'x', id: '1', url: '', preluat: '' } });
const rec = (o = {}) => ({ id: 's-1', creat: 1000, data: '2026-11-27', ora: '13:05', masa: 'pranz', nume: 'Pui cu orez', idIntrare: 'u-1', articole: [art('Piept de pui', 165), art('Orez fiert', 130)], total: { kcal: 295, proteine: 20, carbohidrati: 10, grasimi: 4, fibre: 2 }, poza: null, tokeni: { intrare: 1300, iesire: 450 }, ...o });

test('istoric: înregistrările se validează; cele stricate nu apar', () => {
  const r = H.curataInregistrareScanare(rec());
  assert.equal(r.articole.length, 2);
  assert.deepEqual(r.tokeni, { intrare: 1300, iesire: 450 });
  assert.equal(H.curataInregistrareScanare({ ...rec(), id: '' }), null);
  assert.equal(H.curataInregistrareScanare({ ...rec(), articole: [] }), null);
  assert.equal(H.curataInregistrareScanare(rec({ data: 'ieri', ora: 'x' })).data, '');
});

test('istoric: căutare după masă sau aliment, fără diacritice', () => {
  const l = [rec(), rec({ id: 's-2', nume: 'Sarmale', articole: [art('Sarmale cu porc', 200)] })];
  assert.deepEqual(H.filtreazaScanari(l, 'orez').map(s => s.id), ['s-1']);
  assert.deepEqual(H.filtreazaScanari(l, 'SARMALE porc').map(s => s.id), ['s-2']);
  assert.deepEqual(H.filtreazaScanari(l, 'piept pui').map(s => s.id), ['s-1']);
  assert.equal(H.filtreazaScanari(l, '').length, 2);
});

test('istoric: comparare (b față de a)', () => {
  const c = H.comparaScanari(rec(), rec({ total: { kcal: 400, proteine: 25.5, carbohidrati: 10, grasimi: 1, fibre: 2 } }));
  assert.deepEqual(c.map(x => x.diferenta), [105, 5.5, 0, -3, 0]);
});

test('păstrarea pozelor: nu / 30 / 90 de zile / mereu; setarea e validată', () => {
  const acum = 100 * 86400000;
  assert.equal(H.limitaPozeScanare('mereu', acum), null);
  assert.equal(H.limitaPozeScanare('nu', acum), Infinity);
  assert.equal(H.limitaPozeScanare('30', acum), 70 * 86400000);
  assert.equal(H.limitaPozeScanare('90', acum), 10 * 86400000);
  assert.deepEqual(H.OPTIUNI_POZE_SCANARE.map(o => o.id), ['nu', '30', '90', 'mereu']);
});

test('contor: scanările de azi (după server), tokenii lunii, costul estimat; luna nouă pornește de la zero', () => {
  let c = H.actualizeazaContorScanari(null, { utilizare: { azi: 1, limita: 20 }, tokeni: { intrare: 1300, iesire: 500 } }, new Date(2026, 10, 27, 13));
  c = H.actualizeazaContorScanari(c, { utilizare: { azi: 2, limita: 20 }, tokeni: { intrare: 1200, iesire: 400 } }, new Date(2026, 10, 27, 14));
  assert.deepEqual([c.zi, c.aziServer, c.limitaServer, c.luna, c.scanariLuna, c.intrare, c.iesire], ['2026-11-27', 2, 20, '2026-11', 2, 2500, 900]);
  assert.ok(Math.abs(H.costEstimatScanari(c) - (2500 * 0.25 + 900 * 1.5) / 1e6) < 1e-12);
  const d = H.actualizeazaContorScanari(c, { utilizare: { azi: 1, limita: 20 }, tokeni: { intrare: 10, iesire: 10 } }, new Date(2026, 11, 1, 9));
  assert.deepEqual([d.luna, d.scanariLuna, d.intrare], ['2026-12', 1, 10]);
});

test('limita ta: blochează doar când azi ai atins-o (după numărul serverului)', () => {
  const c = { zi: '2026-11-27', aziServer: 5 };
  assert.equal(H.verificaLimitaProprie(c, null, '2026-11-27'), null, 'fără limită proprie');
  assert.equal(H.verificaLimitaProprie(c, 10, '2026-11-27'), null);
  assert.equal(H.verificaLimitaProprie(c, 5, '2026-11-27').cod, 'limita_proprie');
  assert.equal(H.verificaLimitaProprie(c, 5, '2026-11-28'), null, 'altă zi');
});
