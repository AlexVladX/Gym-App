// Etapa 7, funcția 2: copierea zilei de ieri, a unei mese, „Ca ieri”, Recente și Frecvente pe masă.
const test = require('node:test');
const assert = require('node:assert/strict');
const Z = require('../nutritie-zi.js');

let n = 0;
const idNou = () => `nou-${++n}`;
const v = kcal => ({ kcal, proteine: kcal / 10, carbohidrati: 10, grasimi: 5, fibre: 1 });
const intrare = (id, masa, nume, kcal, extra = {}) => ({ id, masa, idReteta: null, nume, portii: 1, valoriPortie: v(kcal), stare: 'complet', adaugat: 1000, modificat: 1000, ...extra });
const IERI = {
  data: '2026-11-27',
  mese: [
    intrare('a', 'mic-dejun', 'Brânză de vaci', 81),
    intrare('b', 'pranz', 'Chiftele, ardei copți', 1190, { sursa: 'scanare', ora: '13:05', scanare: { articole: [{ nume: 'Chiftele', grame: 300 }] } }),
    intrare('c', 'gustare-2', 'Ovăz cu banană', 572, { idReteta: 'r-ovaz', portii: 1.5, stare: 'partial', portiiMancate: 1, blocat: true, ajustat: true }),
  ],
  cafele: [{ id: 'cafea-ieri' }],
};

test('copiere în zi goală: copii noi, planificate implicit, fără cafea; ziua sursă rămâne la fel', () => {
  const sursaInainte = JSON.stringify(IERI);
  const r = Z.copieZi({ sursa: IERI, tinta: null, data: '2026-11-28', idNou, acum: 5 });
  assert.equal(r.adaugate, 3);
  assert.equal(r.zi.data, '2026-11-28');
  assert.equal(r.zi.cafele, undefined, 'cafeaua nu se copiază');
  for (const i of r.zi.mese) {
    assert.ok(i.id.startsWith('nou-'));
    assert.equal(i.stare, 'neinceput');
    assert.equal(i.adaugat, 5);
    assert.equal(i.portiiMancate, undefined);
    assert.equal(i.blocat, undefined);
    assert.equal(i.ora, undefined, 'o masă planificată nu are oră');
  }
  const scanata = r.zi.mese.find(i => i.nume.startsWith('Chiftele'));
  assert.deepEqual(scanata.scanare, IERI.mese[1].scanare, 'masa din poză își păstrează valorile');
  assert.equal(r.zi.mese.find(i => i.idReteta === 'r-ovaz').portii, 1.5, 'porția rămâne');
  assert.deepEqual(r.zi.mese.map(i => i.masa), ['mic-dejun', 'pranz', 'gustare-2'], 'în ordinea meselor');
  assert.equal(JSON.stringify(IERI), sursaInainte, 'ziua sursă nu se schimbă');
});

test('copiere direct ca mâncate: păstrează ora meselor din poză', () => {
  const r = Z.copieZi({ sursa: IERI, data: '2026-11-28', stare: 'complet', idNou });
  assert.ok(r.zi.mese.every(i => i.stare === 'complet'));
  assert.equal(r.zi.mese.find(i => i.sursa === 'scanare').ora, '13:05');
});

test('adăugare peste ce e în zi: nimic nu se pierde (nici cafeaua zilei țintă)', () => {
  const azi = { data: '2026-11-28', mese: [intrare('x', 'cina', 'Ciorbă', 300, { stare: 'neinceput' })], cafele: [{ id: 'cafea-azi' }] };
  const r = Z.copieZi({ sursa: IERI, tinta: azi, mod: 'adauga', idNou });
  assert.equal(r.zi.mese.length, 4);
  assert.ok(r.zi.mese.some(i => i.id === 'x'));
  assert.deepEqual(r.zi.cafele, [{ id: 'cafea-azi' }]);
  assert.deepEqual(r.zi.mese.map(i => i.masa), ['mic-dejun', 'pranz', 'gustare-2', 'cina']);
});

test('înlocuire: scoate ce n-ai început; mesele mâncate rămân, se șterg doar cu stergeMancate', () => {
  const azi = { data: '2026-11-28', mese: [
    intrare('x', 'cina', 'Ciorbă', 300, { stare: 'neinceput' }),
    intrare('y', 'mic-dejun', 'Omletă', 400, { stare: 'complet' }),
    intrare('z', 'pranz', 'Paste', 600, { stare: 'partial', portiiMancate: 0.5 }),
  ] };
  const r = Z.copieZi({ sursa: IERI, tinta: azi, mod: 'inlocuieste', idNou });
  assert.deepEqual(r.sterse.map(i => i.id), ['x']);
  assert.equal(r.pastrate, 2);
  assert.ok(r.zi.mese.some(i => i.id === 'y') && r.zi.mese.some(i => i.id === 'z'), 'mâncate / începute protejate');
  assert.ok(!r.zi.mese.some(i => i.id === 'x'));
  const tot = Z.copieZi({ sursa: IERI, tinta: azi, mod: 'inlocuieste', stergeMancate: true, idNou });
  assert.deepEqual(tot.sterse.map(i => i.id).sort(), ['x', 'y', 'z']);
  assert.equal(tot.zi.mese.length, 3);
});

test('anulare: ziua de dinainte se poate pune la loc exact (copiile nu modifică obiectul țintei)', () => {
  const azi = { data: '2026-11-28', mese: [intrare('x', 'cina', 'Ciorbă', 300)], cafele: [] };
  const inainte = JSON.stringify(azi);
  Z.copieZi({ sursa: IERI, tinta: azi, mod: 'inlocuieste', stergeMancate: true, idNou });
  assert.equal(JSON.stringify(azi), inainte);
});

test('copierea unei mese în altă zi și în altă masă', () => {
  const azi = { data: '2026-11-28', mese: [intrare('x', 'mic-dejun', 'Cafea cu lapte', 80)] };
  const r = Z.copieMasa({ sursa: IERI, idMasa: 'pranz', tinta: azi, masaTinta: 'cina', idNou });
  assert.equal(r.adaugate, 1);
  const c = r.zi.mese.find(i => i.nume.startsWith('Chiftele'));
  assert.equal(c.masa, 'cina');
  assert.equal(c.stare, 'neinceput');
  assert.notEqual(c.id, 'b');
  assert.equal(r.zi.mese.length, 2);
  assert.equal(IERI.mese[1].masa, 'pranz', 'originalul rămâne la prânz');
  const goala = Z.copieMasa({ sursa: IERI, idMasa: 'cina', tinta: azi, idNou });
  assert.equal(goala.adaugate, 0);
});

test('rezumatul zilei de ieri și „Ca ieri” pe o masă goală', () => {
  assert.deepEqual(Z.rezumatMeseZi(IERI), { numar: 3, kcal: Math.round(81 + 1190 + 572 * 1.5), proteine: Math.round(8.1 + 119 + 57.2 * 1.5) });
  const s = Z.sugestieCaIeri(IERI, 'gustare-2');
  assert.deepEqual(s.nume, ['Ovăz cu banană']);
  assert.equal(s.kcal, Math.round(572 * 1.5));
  assert.equal(Z.sugestieCaIeri(IERI, 'cina'), null);
  assert.equal(Z.sugestieCaIeri(null, 'pranz'), null);
});

test('Recente și Frecvente pe masă: ordonate corect, cu porția folosită ultima dată', () => {
  const zi = (data, mese) => ({ data, mese });
  const zile = [
    zi('2026-10-20', [intrare('o1', 'mic-dejun', 'Ovăz', 300, { idReteta: 'r-ovaz', adaugat: 1 })]), // în afara celor 30 de zile
    zi('2026-11-20', [intrare('o2', 'mic-dejun', 'Ovăz', 300, { idReteta: 'r-ovaz', portii: 1, adaugat: 20 }), intrare('m1', 'mic-dejun', 'Măr', 95, { adaugat: 21 })]),
    zi('2026-11-24', [intrare('o3', 'mic-dejun', 'Ovăz', 300, { idReteta: 'r-ovaz', portii: 2, adaugat: 24 }), intrare('p1', 'pranz', 'Pui', 500, { adaugat: 25 })]),
    zi('2026-11-26', [intrare('m2', 'mic-dejun', 'Măr', 95, { adaugat: 26 }), intrare('b1', 'mic-dejun', 'Banană', 105, { adaugat: 27 })]),
    zi('2026-11-27', [intrare('o4', 'mic-dejun', 'Ovăz', 300, { idReteta: 'r-ovaz', portii: 1.5, adaugat: 30 }), intrare('o5', 'mic-dejun', 'Ovăz', 300, { idReteta: 'r-ovaz', adaugat: 31 })]),
  ];
  const rec = Z.recentePeMasa(zile, 'mic-dejun', 5);
  assert.deepEqual(rec.map(i => i.nume), ['Ovăz', 'Banană', 'Măr'], 'cel mai recent întâi, fără dubluri, doar la micul dejun');
  const fr = Z.frecventePeMasa(zile, { idMasa: 'mic-dejun', azi: '2026-11-28' });
  assert.deepEqual(fr.map(x => [x.intrare.nume, x.numar]), [['Ovăz', 3], ['Măr', 2]], 'zile diferite, în ultimele 30 de zile; o singură dată = nu e frecvent');
  assert.equal(fr[0].intrare.id, 'o5', 'cu ultima folosire (porția de atunci)');
  const faraRecente = Z.frecventePeMasa(zile, { idMasa: 'mic-dejun', azi: '2026-11-28', exclude: new Set(['r:r-ovaz']) });
  assert.deepEqual(faraRecente.map(x => x.intrare.nume), ['Măr']);
  assert.deepEqual(Z.frecventePeMasa(zile, { idMasa: 'pranz', azi: '2026-11-28' }), []);
});
