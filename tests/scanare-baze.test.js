// Scanarea meselor, etapa 2: potrivire locală, căutare USDA/OFF (normalizare + ordonare), unități, calcul, total.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const B = require('../scanare-baze.js');
const { ALIMENTE_BAZA } = require('../nutritie-alimente.js');
const { RETETE_BAZA } = require('../nutritie-retete.js');
const { indexAlimente, valoriAliment, valoriPortie } = require('../nutritie-calcul.js');

const idx = indexAlimente(ALIMENTE_BAZA);
const logica = () => import(pathToFileURL(path.join(__dirname, '../supabase/functions/scanare/logica.js')).href);
const local = (nume, numeEn, preparare) => {
  const a = { nume, numeEn, preparare };
  const c = B.candidatiLocaliScanare(a, ALIMENTE_BAZA, RETETE_BAZA, idx);
  return { c, ales: B.alegeLocalScanare(c) };
};
const articol = (o = {}) => B.initializeazaCantitateScanare({ id: 'x', nume: 'Pui', numeEn: 'chicken', grame: 150, grameEstimat: 150, grameMin: 120, grameMax: 190, sursaGramaj: 'estimat', preparare: 'necunoscut', bucati: null, ...o });

test('local: alimentele simple din aplicație se aleg automat (fără rețea)', () => {
  for (const [n, e, p, id] of [['Broccoli', 'broccoli, raw', 'crud', 'broccoli'], ['Unt', 'butter', 'necunoscut', 'unt'], ['Ou crud', 'egg, whole, raw', 'crud', 'ou'], ['Banană', 'banana, raw', 'crud', 'banana'], ['Pâine albă', 'bread, white', 'necunoscut', 'paine-alba']]) {
    const { ales } = local(n, e, p);
    assert.equal(ales && ales.tip, 'local', n);
    assert.equal(ales.id, id, n);
    assert.equal(ales.eticheta, 'Din aplicație · USDA SR28');
  }
});

test('local: valori pentru crud NU se folosesc automat pentru un aliment gătit (orez fiert, pui la grătar)', () => {
  for (const [n, e, p] of [['Orez alb fiert', 'rice, white, cooked', 'fiert'], ['Piept de pui la grătar', 'chicken breast, grilled', 'gratar'], ['Ouă fierte', 'egg, hard-boiled', 'fiert']]) {
    const { c, ales } = local(n, e, p);
    assert.equal(ales, null, n);
    const crud = c.find(x => x.tip === 'local' && x.stare === 'crud');
    assert.ok(crud && crud.avertizari[0].includes('crud'), `${n}: varianta crudă rămâne propusă, cu avertizare`);
  }
});

test('local: rețetele — „Ciorbă de perișoare” automat; „Sarmale” (3 rețete) și „Pizza” rămân la alegere', () => {
  const ciorba = local('Ciorbă de perișoare', 'meatball soup', 'fiert');
  assert.equal(ciorba.ales && ciorba.ales.tip, 'reteta');
  assert.match(ciorba.ales.nume, /Ciorbă de perișoare/);
  const sarmale = local('Sarmale', 'stuffed cabbage rolls', 'fiert');
  assert.equal(sarmale.ales, null);
  assert.ok(sarmale.c.filter(x => x.tip === 'reteta' && /Sarmale/.test(x.nume)).length >= 3);
  assert.equal(local('Pizza', 'pizza, cheese', 'cuptor').ales, null);
  assert.equal(local('Paste cu sos de roșii', 'pasta, tomato sauce', 'fiert').ales, null, 'nu o rețetă cu chiftele');
  assert.equal(local('Piept de pui la grătar', 'chicken breast, grilled', 'gratar').ales, null, 'nu rețeta „Piept de pui cu orez și broccoli”');
});

test('rețeta: valorile pe porție vin din calculatorul existent', () => {
  const r = RETETE_BAZA.find(x => /Ciorbă de perișoare/.test(x.nume));
  const p = B.potrivireDinReteta(r, idx);
  const v = valoriPortie(r, idx);
  assert.equal(p.valoriPortie.kcal, v.kcal);
  let a = B.aplicaPotrivireScanare(articol(), p);
  assert.deepEqual([a.unitate, a.cantitate, a.grame], ['portie', 1, null]);
  a = B.seteazaCantitateScanare(a, '2');
  assert.ok(Math.abs(B.valoriArticolScanare(a).kcal - 2 * v.kcal) < 1e-9);
  assert.deepEqual(B.unitatiArticolScanare(a).map(u => u.id), ['portie']);
});

test('server: rezultatele USDA → valori la 100 g cu sursă, id, link și dată; lipsurile rămân lipsă', async () => {
  const L = await logica();
  const f = { fdcId: 171534, description: 'Chicken, broilers or fryers, breast, meat only, cooked, roasted', dataType: 'SR Legacy',
    foodNutrients: [{ nutrientId: 1008, unitName: 'KCAL', value: 165 }, { nutrientId: 1003, value: 31.02 }, { nutrientId: 1004, value: 3.57 }, { nutrientId: 1005, value: 0 }, { nutrientNumber: '606', value: 1.01 }],
    foodMeasures: [{ disseminationText: '1 cup, chopped or diced', gramWeight: 140 }, { disseminationText: 'Quantity not specified', gramWeight: 100 }] };
  const c = L.candidatDinFDC(f, '2026-11-27');
  assert.deepEqual(c.per100, { kcal: 165, proteine: 31.02, grasimi: 3.57, carbohidrati: 0, fibre: null, zahar: null, saturate: 1.01 });
  assert.equal(c.url, 'https://fdc.nal.usda.gov/food-details/171534/nutrients');
  assert.equal(c.preluat, '2026-11-27');
  assert.deepEqual(c.portii, [{ nume: '1 cup, chopped or diced', grame: 140 }]);
  // Foundation fără 1008: energia Atwater; kJ nu e luat drept kcal
  const fd = L.candidatDinFDC({ fdcId: 1, description: 'X', dataType: 'Foundation', foodNutrients: [{ nutrientId: 1008, unitName: 'kJ', value: 690 }, { nutrientId: 2047, unitName: 'KCAL', value: 165 }, { nutrientId: 1003, value: 1 }, { nutrientId: 1004, value: 1 }, { nutrientId: 1005, value: 1 }] }, 'd');
  assert.equal(fd.per100.kcal, 165);
  assert.equal(L.candidatDinFDC({ fdcId: 2, description: 'fără kcal', foodNutrients: [{ nutrientId: 1003, value: 3 }] }, 'd'), null, 'fără kcal → respins, nu completat');
});

test('server: Open Food Facts → doar cu kcal și macro la 100 g; adresele de căutare', async () => {
  const L = await logica();
  const p = { code: '5941234567890', product_name: 'Iaurt grecesc 2%', brands: 'Olympus', serving_quantity: '150', serving_size: '150 g', nutriments: { 'energy-kcal_100g': 73, proteins_100g: 9, carbohydrates_100g: 3.5, fat_100g: 2, sugars_100g: 3.5 } };
  const c = L.candidatDinOFF(p, '2026-11-27');
  assert.equal(c.sursa, 'off');
  assert.equal(c.per100.kcal, 73);
  assert.equal(c.per100.fibre, null);
  assert.deepEqual(c.portii, [{ nume: '150 g', grame: 150 }]);
  assert.equal(L.candidatDinOFF({ ...p, nutriments: { 'energy-kj_100g': 300 } }, 'd'), null);
  assert.equal(L.candidatDinOFF({ ...p, code: 'abc' }, 'd'), null);
  assert.deepEqual(L.corpCautareFDC('rice, white, cooked', false), { query: 'rice, white, cooked', dataType: ['Foundation', 'SR Legacy', 'Survey (FNDDS)'], pageSize: 8 });
  assert.ok(L.corpCautareFDC('chips', true).dataType.includes('Branded'));
  assert.ok(!/api_key/.test(L.CALE_CAUTARE_FDC), 'cheia USDA nu e în adresă (merge în antet)');
  assert.throws(() => L.valideazaCautare({ cereri: [] }));
  assert.throws(() => L.valideazaCautare({ cereri: Array(16).fill({ text: 'ou' }) }));
  assert.deepEqual(L.valideazaCautare({ cereri: [{ id: 'a', text: ' egg ', ambalat: true, marca: 'X' }] }), [{ id: 'a', text: 'egg', ambalat: true, marca: 'X' }]);
});

test('server: AI-ul poate număra bucăți identice (6 burgeri)', async () => {
  const L = await logica();
  const r = L.curataRaspunsAI({ este_mancare: true, calitate_imagine: 'buna', alimente: [{ nume: 'Burger', nume_en: 'hamburger', grame: 1200, grame_min: 1000, grame_max: 1400, preparare: 'gratar', incredere: 'ridicata', bucati: 6 }, { nume: 'Ou', nume_en: 'egg', grame: 50, grame_min: 45, grame_max: 55, preparare: 'fiert', incredere: 'ridicata', bucati: 1 }] });
  assert.equal(r.alimente[0].bucati, 6);
  assert.ok(!('bucati' in r.alimente[1]));
  assert.match(L.INSTRUCTIUNI, /bucati/);
});

test('extern: ordonare — starea gătit/crud, plauzibilitatea și mărcile contează; la egalitate alegi tu', () => {
  const a = { nume: 'Piept de pui la grătar', numeEn: 'chicken breast, roasted', preparare: 'gratar' };
  const srv = [
    { sursa: 'usda', id: '171477', nume: 'Chicken, broilers or fryers, breast, meat only, raw', tipDate: 'SR Legacy', per100: { kcal: 120, proteine: 22.5, carbohidrati: 0, grasimi: 2.62 } },
    { sursa: 'usda', id: '171534', nume: 'Chicken, broilers or fryers, breast, meat only, cooked, roasted', tipDate: 'SR Legacy', per100: { kcal: 165, proteine: 31, carbohidrati: 0, grasimi: 3.57 } },
    { sursa: 'usda', id: '999', nume: 'CHICKEN BREAST ROASTED', tipDate: 'Branded', per100: { kcal: 110, proteine: 20, carbohidrati: 1, grasimi: 3 } },
    { sursa: 'usda', id: '5', nume: 'Chicken breast roasted', tipDate: 'SR Legacy', per100: { kcal: 600, proteine: 20, carbohidrati: 1, grasimi: 3 } },
  ];
  const r = B.ordoneazaExterneScanare(a, srv);
  assert.equal(r.ales && r.ales.id, '171534', 'gătit, generic, plauzibil');
  assert.equal(r.candidati[r.candidati.length - 1].id, '5', 'valori incoerente la coadă');
  assert.ok(r.candidati.find(x => x.id === '5').avertizari.some(t => /nu se potrivesc/.test(t)));
  const amb = B.ordoneazaExterneScanare({ nume: 'Burger', numeEn: 'hamburger', preparare: 'gratar' }, [
    { sursa: 'usda', id: '1', nume: 'Hamburger, single patty, plain', tipDate: 'Survey (FNDDS)', per100: { kcal: 260, proteine: 13, carbohidrati: 26, grasimi: 11 } },
    { sursa: 'usda', id: '2', nume: 'Hamburger, double patty, plain', tipDate: 'Survey (FNDDS)', per100: { kcal: 270, proteine: 15, carbohidrati: 22, grasimi: 13 } },
  ]);
  assert.equal(amb.ales, null, 'două variante la fel de bune → tu alegi');
  const marca = B.ordoneazaExterneScanare({ nume: 'Iaurt', numeEn: 'greek yogurt', ambalat: true, marca: 'Olympus' }, [
    { sursa: 'off', id: '111111', nume: 'Greek yogurt', marca: 'Altă marcă', per100: { kcal: 97, proteine: 9, carbohidrati: 4, grasimi: 5 } },
    { sursa: 'off', id: '222222', nume: 'Greek yogurt', marca: 'Olympus', per100: { kcal: 73, proteine: 9, carbohidrati: 3.5, grasimi: 2 } },
  ]);
  assert.equal(marca.candidati[0].id, '222222', 'marca de pe ambalaj câștigă');
});

test('unități: bucăți estimate din poză, porții din sursă, ml cu presupunere afișată; greutatea se păstrează', () => {
  let a = articol({ nume: 'Burger', grame: 1200, grameEstimat: 1200, bucati: 6 });
  assert.deepEqual([a.unitate, a.cantitate], ['buc', 6]);
  a = B.aplicaPotrivireScanare(a, B.potrivireDinExtern({ sursa: 'usda', id: '1', nume: 'Hamburger', per100: { kcal: 260, proteine: 13, carbohidrati: 26, grasimi: 11 }, portii: [{ nume: '1 sandwich', grame: 110 }] }, a));
  const u = B.unitatiArticolScanare(a);
  assert.deepEqual(u.map(x => x.id), ['g', 'buc', 'p0', 'ml']);
  assert.match(u[1].nume, /estimată din poză/);
  assert.match(u[3].nume, /presupus 1 ml = 1 g/);
  a = B.seteazaCantitateScanare(a, '2');
  assert.deepEqual([a.grame, a.sursaGramaj], [400, 'manual'], '2 burgeri × 200 g');
  a = B.seteazaUnitateScanare(a, 'g');
  assert.deepEqual([a.cantitate, a.grame], [400, 400]);
  a = B.seteazaUnitateScanare(a, 'p0');
  assert.deepEqual([a.cantitate, a.grame], [3.6, 396]);
  a = B.seteazaCantitateScanare(B.seteazaUnitateScanare(a, 'buc'), '6');
  assert.equal(a.sursaGramaj, 'estimat', 'înapoi la estimarea din poză');
});

test('calcul: (cantitate / 100) × valoarea la 100 g, cu calculatorul existent; totalul exclude alimentele fără valori', () => {
  const pui = ALIMENTE_BAZA.find(x => x.id === 'pui-piept');
  let a = B.aplicaPotrivireScanare(articol({ grame: 200, grameEstimat: 200 }), B.potrivireDinAliment(pui));
  const v = B.valoriArticolScanare(a);
  const asteptat = valoriAliment(pui, 200);
  assert.equal(v.kcal, asteptat.kcal);
  assert.equal(v.zahar, null, 'zahărul lipsește în baza locală → nu se inventează');
  const usda = B.aplicaPotrivireScanare(articol({ id: 'y', grame: 50, grameEstimat: 50 }), B.potrivireDinExtern({ sursa: 'usda', id: '9', nume: 'X', per100: { kcal: 100, proteine: 10, carbohidrati: 10, grasimi: 2.2, zahar: 4, saturate: 1 } }));
  assert.equal(B.valoriArticolScanare(usda).zahar, 2);
  const fara = articol({ id: 'z', potrivire: null });
  const t = B.totalScanare([a, usda, fara]);
  assert.equal(t.valori.kcal, Math.round(asteptat.kcal + 50));
  assert.equal(t.lipsa, 1);
  assert.equal(t.zahar, null, 'nu toate au zahăr → nu se afișează un total parțial');
  assert.equal(B.totalScanare([usda]).zahar, 2);
  assert.equal(B.valoriArticolScanare(B.seteazaCantitateScanare(a, '')), null, 'fără cantitate → fără valori');
  assert.match(B.textValoriScanare(v), /^\d+ kcal · P [\d,]+ g/);
});

test('valori scrise de tine: validate; avertizările se recalculează când schimbi prepararea', () => {
  assert.equal(B.potrivireManualaScanare({ kcal: '', proteine: 1, carbohidrati: 1, grasimi: 1 }), null);
  assert.equal(B.potrivireManualaScanare({ kcal: 950, proteine: 1, carbohidrati: 1, grasimi: 1 }), null);
  assert.equal(B.potrivireManualaScanare({ kcal: 300, proteine: 60, carbohidrati: 30, grasimi: 20 }), null, 'peste 100 g la 100 g');
  const m = B.potrivireManualaScanare({ kcal: '250', proteine: '12,5', carbohidrati: 30, grasimi: 9 });
  assert.deepEqual([m.tip, m.eticheta, m.per100.proteine, m.per100.fibre], ['manual', 'Scris de tine', 12.5, 0]);
  const orez = ALIMENTE_BAZA.find(x => x.id === 'orez');
  let a = B.aplicaPotrivireScanare(articol({ nume: 'Orez', preparare: 'crud' }), B.potrivireDinAliment(orez));
  assert.deepEqual(B.avertizariPotrivireScanare(a), []);
  a = { ...a, preparare: 'fiert' };
  assert.match(B.avertizariPotrivireScanare(a)[0], /alimentul crud, iar cel din poză pare gătit/);
});

test('cache-ul căutărilor: 30 de zile, cheie după text, marcă și tip', () => {
  const m = new Map();
  const st = { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) };
  const k = B.cheieCautareScanare({ text: 'Rice, cooked', ambalat: false, marca: '' });
  assert.notEqual(k, B.cheieCautareScanare({ text: 'Rice, cooked', ambalat: true, marca: 'X' }));
  B.scrieCacheCautari(st, k, [{ id: 1 }], 1e12);
  assert.deepEqual(B.citesteCacheCautari(st, k, 1e12 + 1000), [{ id: 1 }]);
  assert.equal(B.citesteCacheCautari(st, k, 1e12 + 31 * 86400000), null);
});

test('potrivire: cuvintele se compară întregi — „cheeseburger” nu propune brânză; bacon „unprepared” = crud', () => {
  assert.equal(local('mini burgeri', 'mini cheeseburgers', 'gratar').c.filter(x => x.tip === 'local').length, 0);
  assert.equal(local('pizza cu ciuperci', 'mushroom pizza', 'cuptor').ales, null, 'nu „Ciuperci” pentru pizza');
  assert.equal(B.stareDinTextScanare('Pork, cured, bacon, unprepared'), 'crud');
  assert.ok(B.asemanareScanare('burgeri', 'burger') > 0.9);
  assert.ok(B.asemanareScanare('tomatoes', 'tomato') > 0.9);
  assert.equal(B.asemanareScanare('cheeseburger', 'cheese'), 0);
  const ext = B.ordoneazaExterneScanare({ nume: 'Pizza cu ciuperci', numeEn: 'mushroom pizza', preparare: 'cuptor' }, [
    { sursa: 'usda', id: '1', nume: 'Mushrooms, white, cooked, boiled', tipDate: 'SR Legacy', per100: { kcal: 28, proteine: 2.2, carbohidrati: 5.3, grasimi: 0.5 } }]);
  assert.equal(ext.ales, null, 'doar „mushrooms” fără „pizza” → nu se alege automat');
});

test('bufet: AI-ul poate spune că nu e o porție individuală; variantele fără legătură nu se arată', async () => {
  const L = await logica();
  const r = L.curataRaspunsAI({ este_mancare: true, portie_individuala: false, calitate_imagine: 'buna', alimente: [{ nume: 'Cașcaval cuburi', nume_en: 'cheese cubes', grame: 600, grame_min: 400, grame_max: 800, preparare: 'crud', incredere: 'ridicata' }] });
  assert.equal(r.portieIndividuala, false);
  assert.equal(L.curataRaspunsAI({ este_mancare: true, calitate_imagine: 'buna', alimente: [] }).portieIndividuala, true, 'lipsă → porție individuală');
  assert.match(L.INSTRUCTIUNI, /Never lump many different foods/);
  const ext = B.ordoneazaExterneScanare({ nume: 'Platou aperitive reci', numeEn: 'cold appetizer platter' }, [
    { sursa: 'usda', id: '169841', nume: "APPLEBEE'S, chicken tenders platter", tipDate: 'SR Legacy', per100: { kcal: 297, proteine: 18, carbohidrati: 20, grasimi: 16 } },
    { sursa: 'usda', id: '167702', nume: 'Oil, flaxseed, cold pressed', tipDate: 'SR Legacy', per100: { kcal: 884, proteine: 0.1, carbohidrati: 0, grasimi: 99.9 } },
  ]);
  assert.deepEqual(ext.candidati, [], 'doar „platter”/„cold” în comun → ascunse');
});

test('alimente unite („cartofi prăjiți cu morcov”): promptul le interzice; „Împarte” le desparte cu gramajul împărțit egal', async () => {
  const L = await logica();
  assert.match(L.INSTRUCTIUNI, /exactly ONE food/);
  assert.match(L.INSTRUCTIUNI, /cartofi prăjiți cu morcov/);
  assert.deepEqual(B.partiNumeScanare('cartofi prăjiți cu morcov'), ['cartofi prăjiți', 'morcov']);
  assert.deepEqual(B.partiNumeScanare('Piept de pui cu orez și broccoli'), ['Piept de pui', 'orez', 'broccoli']);
  assert.deepEqual(B.partiNumeScanare('salată verde, roșii, castraveți'), ['salată verde', 'roșii', 'castraveți']);
  assert.equal(B.partiNumeScanare('Ciorbă de perișoare'), null);
  assert.equal(B.partiNumeScanare('Sarmale'), null);
  let n = 0;
  const parti = B.imparteArticolScanare({ id: 'x', nume: 'cartofi prăjiți cu morcov', numeEn: 'fried potatoes with carrots', grame: 250, grameEstimat: 250, grameMin: 200, grameMax: 300, incredere: 'ridicata', preparare: 'prajit', ascunse: ['ulei'], potrivire: { tip: 'local' } }, () => `n${n++}`);
  assert.deepEqual(parti.map(a => [a.id, a.nume, a.numeEn, a.grame, a.cantitate, a.unitate, a.sursaGramaj, a.incredere, a.potrivire]),
    [['n0', 'cartofi prăjiți', 'fried potatoes', 125, 125, 'g', 'estimat', 'medie', null], ['n1', 'morcov', 'carrots', 125, 125, 'g', 'estimat', 'medie', null]]);
  assert.deepEqual(parti[0].ascunse, ['ulei']);
  assert.match(parti[1].note, /părți egale/);
  const fara = B.imparteArticolScanare({ id: 'y', nume: 'pui cu orez', numeEn: 'chicken', grame: 300, grameEstimat: 300, grameMin: 250, grameMax: 350, incredere: 'medie' }, () => 'z');
  assert.deepEqual(fara.map(a => a.numeEn), ['', ''], 'numele englezesc nepereche → căutare după numele românesc');
});
