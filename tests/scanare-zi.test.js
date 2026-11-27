// Scanarea meselor, etapa 3: salvarea în zi (copie a valorilor), editarea fără recalcul din baza de date, biblioteca proprie.
const test = require('node:test');
const assert = require('node:assert/strict');
const Z = require('../nutritie-zi.js');
const B = require('../scanare-baze.js');
const V = require('../validare.js');
const { ALIMENTE_BAZA } = require('../nutritie-alimente.js');
const { RETETE_BAZA } = require('../nutritie-retete.js');
const { indexAlimente, MESE_TOATE, MESE } = require('../nutritie-calcul.js');

const idx = indexAlimente(ALIMENTE_BAZA);
const pregatit = (o, p) => B.aplicaPotrivireScanare(B.initializeazaCantitateScanare({ id: o.id || 'a', nume: o.nume, numeEn: '', grame: o.grame, grameEstimat: o.grame, grameMin: o.grame, grameMax: o.grame, sursaGramaj: 'estimat', preparare: 'necunoscut', bucati: o.bucati || null }), p);
const usda = (id, nume, per100, extra = {}) => B.potrivireDinExtern({ sursa: 'usda', id, nume, tipDate: 'SR Legacy', per100, url: `https://fdc.nal.usda.gov/food-details/${id}/nutrients`, preluat: '2026-11-27', ...extra });

const pui = pregatit({ id: 'p', nume: 'Piept de pui la grătar', grame: 150 }, usda('171534', 'Chicken breast, roasted', { kcal: 165, proteine: 31.02, carbohidrati: 0, grasimi: 3.57, saturate: 1.01 }));
const broccoli = pregatit({ id: 'b', nume: 'Broccoli', grame: 90 }, B.potrivireDinAliment(ALIMENTE_BAZA.find(a => a.id === 'broccoli')));
const ciorba = pregatit({ id: 'c', nume: 'Ciorbă de perișoare', grame: 400 }, B.potrivireDinReteta(RETETE_BAZA.find(r => /Ciorbă de perișoare/.test(r.nume)), idx));

test('„Altă masă” există doar pentru mesele notate de tine; planul are tot 5 mese', () => {
  assert.equal(MESE.length, 5);
  assert.deepEqual(MESE_TOATE.map(m => m.id), ['mic-dejun', 'gustare-1', 'pranz', 'gustare-2', 'cina', 'alta']);
});

test('instantaneu: valorile de acum, sursa, cantitatea și valorile la 100 g / pe porție', () => {
  const s = B.instantaneuArticolScanare(pui);
  assert.deepEqual(s.valori, { kcal: 247.5, proteine: 46.5, carbohidrati: 0, grasimi: 5.4, fibre: 0, saturate: 1.5 });
  assert.deepEqual([s.cantitate, s.unitate, s.grame, s.estimat], [150, 'g', 150, true]);
  assert.deepEqual(s.sursa, { tip: 'usda', eticheta: 'USDA FoodData Central · #171534', nume: 'Chicken breast, roasted', id: '171534', url: 'https://fdc.nal.usda.gov/food-details/171534/nutrients', preluat: '2026-11-27' });
  assert.equal(s.per100.kcal, 165);
  const c = B.instantaneuArticolScanare(ciorba);
  assert.deepEqual([c.unitate, c.grame, c.cantitate], ['porții', null, 1]);
  assert.ok(c.valoriPortie.kcal > 0 && !c.per100);
  assert.equal(B.instantaneuArticolScanare({ ...pui, potrivire: null }), null);
});

test('salvarea: intrare „Mâncată”, valori = suma alimentelor, ora, sursa „scanare”; trece de validarea zilei', () => {
  const articole = [pui, broccoli, ciorba].map(B.instantaneuArticolScanare);
  const i = Z.intrareDinScanare({ id: 'u-x1', masa: 'pranz', nume: '', articole, ora: '13:05', acum: 1000 });
  const asteptat = articole.reduce((s, a) => s + a.valori.kcal, 0);
  assert.equal(Math.round(i.valoriPortie.kcal * 10), Math.round(asteptat * 10));
  assert.deepEqual([i.stare, i.portii, i.idReteta, i.sursa, i.ora, i.masa], ['complet', 1, null, 'scanare', '13:05', 'pranz']);
  assert.equal(i.nume, 'Piept de pui la grătar, Broccoli, Ciorbă de perișoare');
  const zi = Z.curataZiNutritie({ data: '2026-11-27', mese: [i] });
  assert.equal(zi.mese.length, 1);
  assert.equal(zi.mese[0].scanare.articole.length, 3);
  assert.equal(Z.totaluriZi(zi).mancat.kcal, i.valoriPortie.kcal, 'intră în „mâncat” azi');
  assert.throws(() => Z.intrareDinScanare({ id: 'u', masa: 'pranz', articole: [] }), /Nu există niciun aliment/);
  const enorm = { ...articole[0], valori: { ...articole[0].valori, kcal: 9000 } };
  assert.throws(() => Z.intrareDinScanare({ id: 'u', masa: 'pranz', articole: [enorm, enorm] }), /10 000 kcal/);
});

test('istoricul: dacă alimentul din bibliotecă se schimbă, masa salvată rămâne la fel', () => {
  const al = { ...ALIMENTE_BAZA.find(a => a.id === 'broccoli') };
  const art = pregatit({ id: 'b2', nume: 'Broccoli', grame: 100 }, B.potrivireDinAliment(al));
  const i = Z.intrareDinScanare({ id: 'u-x2', masa: 'cina', articole: [B.instantaneuArticolScanare(art)] });
  const inainte = i.valoriPortie.kcal;
  al.kcal = 999; // alimentul se editează ulterior
  assert.equal(Z.curataZiNutritie({ data: '2026-11-27', mese: [i] }).mese[0].valoriPortie.kcal, inainte);
});

test('editare: cantitatea se recalculează din copia salvată; alimentele se pot scoate; totalul se reface', () => {
  const articole = [pui, broccoli, ciorba].map(B.instantaneuArticolScanare);
  const i = Z.intrareDinScanare({ id: 'u-x3', masa: 'pranz', articole });
  const p2 = Z.scaleazaArticolScanat(i.scanare.articole[0], 200);
  assert.deepEqual([p2.grame, p2.valori.kcal, p2.valori.saturate, p2.estimat], [200, 330, 2, false]);
  const c2 = Z.scaleazaArticolScanat(i.scanare.articole[2], 2);
  assert.equal(c2.valori.kcal, Math.round(i.scanare.articole[2].valoriPortie.kcal * 2 * 10) / 10);
  assert.throws(() => Z.scaleazaArticolScanat(i.scanare.articole[0], 0), /invalidă/);
  const noua = Z.modificaIntrareScanata(i, { nume: 'Prânz la birou', masa: 'alta', articole: [p2, i.scanare.articole[1]], acum: 5 });
  assert.equal(noua.nume, 'Prânz la birou');
  assert.equal(noua.masa, 'alta');
  assert.equal(noua.scanare.articole.length, 2);
  assert.equal(noua.valoriPortie.kcal, Math.round((330 + i.scanare.articole[1].valori.kcal) * 10) / 10);
  assert.equal(noua.id, i.id);
  assert.throws(() => Z.modificaIntrareScanata(i, { articole: [] }), /cel puțin un aliment/);
  assert.equal(Z.articolScanatEditabil({ nume: 'x', valori: {}, cantitate: 1, grame: 10 }), false, 'fără valori la 100 g → nu se poate scala');
});

test('validarea copiei: date stricate din cloud/backup se curăță, nu strică ziua', () => {
  const ok = B.instantaneuArticolScanare(pui);
  const s = Z.curataSnapshotScanare({ articole: [ok, { nume: '' }, { nume: 'x', valori: { kcal: 'mult' } }, { ...ok, sursa: { tip: 'hack', url: 'javascript:alert(1)' } }] });
  assert.equal(s.articole.length, 2);
  assert.equal(s.articole[1].sursa.tip, 'manual');
  assert.equal(s.articole[1].sursa.url, '');
  assert.equal(Z.curataSnapshotScanare({ articole: [] }), null);
  const zi = Z.curataZiNutritie({ data: '2026-11-27', mese: [{ id: 'u-1', masa: 'pranz', idReteta: null, nume: 'X', portii: 1, valoriPortie: { kcal: 100, proteine: 1, carbohidrati: 1, grasimi: 1, fibre: 0 }, stare: 'complet', scanare: 'stricat', ora: '99:99' }] });
  assert.equal(zi.mese.length, 1, 'intrarea rămâne, doar câmpurile stricate dispar');
  assert.ok(!('scanare' in zi.mese[0]) && !('ora' in zi.mese[0]));
});

test('confirmare: masa propusă după oră, numele implicit, problemele de salvare', () => {
  assert.deepEqual(['08:00', '11:00', '13:30', '16:45', '20:00'].map(B.masaImplicitaScanare), ['mic-dejun', 'gustare-1', 'pranz', 'gustare-2', 'cina']);
  assert.equal(B.numeImplicitScanare([{ nume: 'pui' }, { nume: 'orez' }, { nume: 'broccoli' }, { nume: 'sos' }]), 'Pui, orez, broccoli +1');
  const fara = { ...broccoli, id: 'f', nume: 'Sos', potrivire: null };
  assert.deepEqual(B.problemeSalvareScanare([pui, fara]), ['„Sos” nu are valori: alege sursa sau șterge-l.']);
  assert.deepEqual(B.problemeSalvareScanare([B.seteazaCantitateScanare(pui, '')]), ['„Piept de pui la grătar” nu are cantitate.']);
  assert.deepEqual(B.problemeSalvareScanare([]), ['Lista e goală. Adaugă cel puțin un aliment.']);
  assert.deepEqual(B.problemeSalvareScanare([pui, broccoli]), []);
});

test('biblioteca ta: doar USDA / Open Food Facts / scris de tine, cu proveniență; trece de validarea alimentelor; duplicate', () => {
  assert.equal(B.poateIntraInBibliotecaScanare(broccoli), false, 'deja în aplicație');
  assert.equal(B.poateIntraInBibliotecaScanare(ciorba), false);
  const al = B.alimentDinScanare(pui, 'u-al1', 7);
  assert.deepEqual(al.provenienta, { tip: 'usda', id: '171534', url: 'https://fdc.nal.usda.gov/food-details/171534/nutrients', preluat: '2026-11-27', verificat: true, numeSursa: 'Chicken breast, roasted', faraFibre: true });
  const curat = V.curataAliment(al);
  assert.ok(curat, 'alimentul trece de validarea existentă');
  assert.equal(curat.kcal, 165);
  assert.equal(curat.provenienta.tip, 'usda', 'proveniența rămâne după validare');
  const man = pregatit({ id: 'm', nume: 'Sos de casă', grame: 40 }, B.potrivireManualaScanare({ kcal: 200, proteine: 2, carbohidrati: 8, grasimi: 18 }));
  const am = B.alimentDinScanare(man, 'u-al2');
  assert.equal(am.provenienta.verificat, false, 'valorile scrise de tine nu sunt „verificate”');
  assert.throws(() => B.alimentDinScanare(broccoli, 'u-x'), /Doar alimentele/);
  assert.equal(B.duplicatAlimentScanare([al], pui).id, 'u-al1', 'același id USDA');
  assert.equal(B.duplicatAlimentScanare([{ ...am, id: 'u-z', nume: 'sos de casa' }], man).id, 'u-z', 'același nume, fără diacritice');
  assert.equal(B.duplicatAlimentScanare([], pui), null);
});
