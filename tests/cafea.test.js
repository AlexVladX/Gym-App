// Faza 4: cafeaua (valori, cofeină, cafeaua zilnică, totaluri, sincronizare, generator).
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../cafea.js');
const Z = require('../nutritie-zi.js');
const S = require('../sincron.js');
const G = require('../nutritie-generator.js');
const { ALIMENTE_BAZA } = require('../nutritie-alimente.js');
const { RETETE_BAZA } = require('../nutritie-retete.js');
const { indexAlimente } = require('../nutritie-calcul.js');

const idx = indexAlimente(ALIMENTE_BAZA);
const A = id => ALIMENTE_BAZA.find(a => a.id === id);

test('alimentele de cafea: valori USDA SR28 și cofeina din FoodData Central (cu sursa)', () => {
  const e = A('cafea-espresso');
  assert.equal(e.ndb, '14210');
  assert.deepEqual([e.kcal, e.proteine, e.carbohidrati, e.grasimi, e.cofeina, e.fdc], [9, 0.12, 1.67, 0.18, 212, 171891]);
  assert.deepEqual([A('cafea-filtru').cofeina, A('cafea-instant').cofeina, A('cafea-decaf').cofeina], [40, 3140, 1]);
  for (const id of ['cafea-espresso', 'cafea-filtru', 'cafea-instant', 'cafea-decaf']) assert.ok(Number.isInteger(A(id).fdc), id);
  // doar alimentele de cafea au cofeină
  assert.deepEqual(ALIMENTE_BAZA.filter(a => 'cofeina' in a).map(a => a.id).sort(), ['cafea-decaf', 'cafea-espresso', 'cafea-filtru', 'cafea-instant']);
});

test('valorile unei cafele: din cantități, cu densitatea laptelui din USDA', () => {
  const dublu = C.valoriCafea({ tip: 'espresso', cantitate: 60 }, idx);
  assert.equal(dublu.cofeina, 127); // 212 mg/100 g × 60 g
  assert.equal(dublu.valori.kcal, 5.4);
  const cap = C.valoriCafea({ tip: 'espresso', cantitate: 30, lapte: 'lapte', lapteMl: 120, zaharG: 5 }, idx);
  const gLapte = 120 * 244 / 236.6;
  const asteptat = 0.3 * A('cafea-espresso').kcal + gLapte / 100 * A('lapte').kcal + 0.05 * A('zahar').kcal;
  assert.equal(cap.valori.kcal, Math.round(asteptat * 10) / 10);
  assert.equal(cap.cofeina, 64); // laptele și zahărul nu au cofeină
  assert.deepEqual(cap.lipsa, []);
  assert.equal(C.valoriCafea({ tip: 'instant', cantitate: 2 }, idx).cofeina, 63); // 3140 × 0,02
  assert.equal(C.valoriCafea({ tip: 'decaf', cantitate: 200 }, idx).cofeina, 2);
  // aliment lipsă: nu se ghicește
  assert.deepEqual(C.valoriCafea({ tip: 'espresso', cantitate: 30 }, new Map()).lipsa, ['cafea-espresso']);
  assert.throws(() => C.cafeaDinCompozitie({ tip: 'espresso', cantitate: 30 }, new Map()), /nu sunt în bibliotecă/);
});

test('validarea formularului de cafea', () => {
  assert.throws(() => C.curataCompozitieCafea({ tip: 'ceai', cantitate: 30 }), /felul/);
  assert.throws(() => C.curataCompozitieCafea({ tip: 'espresso', cantitate: 0 }), /între 1 și 500 ml/);
  assert.throws(() => C.curataCompozitieCafea({ tip: 'instant', cantitate: 50 }), /între 1 și 30 g/);
  assert.throws(() => C.curataCompozitieCafea({ tip: 'espresso', cantitate: 30, lapte: 'frisca', lapteMl: 20 }), /laptele/);
  assert.throws(() => C.curataCompozitieCafea({ tip: 'espresso', cantitate: 30, zaharG: 500 }), /Zahărul/);
  const c = C.curataCompozitieCafea({ tip: 'espresso', cantitate: 30, lapte: 'lapte', lapteMl: 0, ora: '25:00' });
  assert.equal(c.lapte, null);             // lapte fără cantitate = fără lapte
  assert.equal(c.nume, 'Espresso');        // nume implicit
  assert.equal('ora' in c, false);         // oră invalidă scoasă
  assert.equal(C.curataCompozitieCafea({ tip: 'filtru', cantitate: 200, lapte: 'lapte', lapteMl: 50, ora: '07:30' }).nume, 'Cafea la filtru cu lapte');
});

const zilnica = () => C.curataCafeaZilnica({ id: 'dimineata', ...C.cafeaDinCompozitie({ tip: 'espresso', cantitate: 60, nume: 'Espresso dublu', ora: '08:00' }, idx), dela: '2026-11-20', activ: true });

test('cafeaua zilnică: apare de la data de început, o singură dată, cu același conținut pe orice dispozitiv', () => {
  const z = zilnica();
  assert.ok(z);
  const inainte = C.aplicaCafeleZilnice({ data: '2026-11-19', mese: [] }, [z]);
  assert.equal(inainte.schimbat, false);
  const a = C.aplicaCafeleZilnice({ data: '2026-11-21', mese: [] }, [z]);
  const b = C.aplicaCafeleZilnice({ data: '2026-11-21', mese: [] }, [z]);
  assert.equal(a.schimbat, true);
  assert.deepEqual(a.zi, b.zi);                                    // determinist: fără marcaje de timp
  assert.equal(a.zi.cafele[0].id, 'cz-dimineata-2026-11-21');
  assert.equal('baut' in a.zi.cafele[0], false);
  assert.equal(C.aplicaCafeleZilnice(a.zi, [z]).schimbat, false);  // nu se dublează
  // oprită: nu mai apare
  assert.equal(C.aplicaCafeleZilnice({ data: '2026-11-22', mese: [] }, [{ ...z, activ: false }]).schimbat, false);
});

test('scoasă dintr-o zi, cafeaua zilnică nu revine în ziua aceea; o cafea obișnuită se șterge de tot', () => {
  const z = zilnica();
  const zi = C.aplicaCafeleZilnice({ data: '2026-11-21', mese: [], cafele: [{ id: 'u1', ...C.cafeaDinCompozitie({ tip: 'filtru', cantitate: 200 }, idx), baut: true }] }, [z]).zi;
  const fara = C.scoateCafeaDinZi(zi, 'cz-dimineata-2026-11-21');
  assert.deepEqual(fara.cafeleSarite, ['cz-dimineata-2026-11-21']);
  assert.equal(C.aplicaCafeleZilnice(fara, [z]).schimbat, false);
  const faraU1 = C.scoateCafeaDinZi(zi, 'u1');
  assert.equal(faraU1.cafele.length, 1);
  assert.equal('cafeleSarite' in faraU1, false);
});

test('băută: explicit dacă ai bifat; cafeaua zilnică e băută până azi și planificată în viitor', () => {
  const z = zilnica();
  const ieri = C.aplicaCafeleZilnice({ data: '2026-11-21', mese: [] }, [z]).zi;
  const maine = C.aplicaCafeleZilnice({ data: '2026-11-23', mese: [] }, [z]).zi;
  assert.equal(C.totalCafeaZi(ieri, '2026-11-22').cofeina, 127);
  const tm = C.totalCafeaZi(maine, '2026-11-22');
  assert.deepEqual([tm.cofeina, tm.cofeinaPlan, tm.baute], [0, 127, 0]);
  const nebauta = { ...ieri, cafele: ieri.cafele.map(c => ({ ...c, baut: false })) };
  assert.equal(C.totalCafeaZi(nebauta, '2026-11-22').cofeina, 0);
});

test('totalurile zilei includ cafeaua (planificat = toată, mâncat = cea băută); numărul de mese nu se schimbă', () => {
  const cafea = { id: 'u1', ...C.cafeaDinCompozitie({ tip: 'espresso', cantitate: 30, lapte: 'lapte', lapteMl: 200 }, idx) };
  const zi = { data: '2026-11-22', mese: [], cafele: [{ ...cafea, baut: true }, { ...cafea, id: 'u2', baut: false }] };
  const t = Z.totaluriZi(zi, '2026-11-22');
  assert.equal(Math.round(t.planificat.kcal * 10), Math.round(cafea.valori.kcal * 2 * 10));
  assert.equal(Math.round(t.mancat.kcal * 10), Math.round(cafea.valori.kcal * 10));
  assert.equal(t.numar, 0);
  // zilele fără cafele: exact ca înainte
  assert.deepEqual(Z.totaluriZi({ data: '2026-11-22', mese: [] }).planificat, { kcal: 0, proteine: 0, carbohidrati: 0, grasimi: 0, fibre: 0 });
});

test('media săptămânii: o zi doar cu cafea nu umflă media pe zilele cu mese', () => {
  const cafea = { id: 'u1', ...C.cafeaDinCompozitie({ tip: 'filtru', cantitate: 200, lapte: 'lapte', lapteMl: 100, zaharG: 10 }, idx), baut: true };
  const r = RETETE_BAZA[0];
  const { valoriPortie } = require('../nutritie-calcul.js');
  const i = Z.intrareMasa({ id: 'm1', masa: r.masa, reteta: r, valoriPortieReteta: valoriPortie(r, idx) });
  const s = Z.totaluriSaptamana([{ data: '2026-11-16', mese: [i] }, { data: '2026-11-17', mese: [], cafele: [cafea] }], null);
  assert.equal(s.zileCuMese, 1);
  assert.equal(Math.round(s.mediePlanificat.kcal), Math.round(i.valoriPortie.kcal));
});

test('validarea zilei păstrează cafelele bune și scoate ce e stricat', () => {
  const bun = { id: 'u1', ...C.cafeaDinCompozitie({ tip: 'espresso', cantitate: 30 }, idx), baut: true };
  const z = Z.curataZiNutritie({ data: '2026-11-22', mese: [], cafele: [bun, { id: 'x', tip: 'espresso', cantitate: 30, valori: { kcal: -5 } }, bun, null],
    cafeleSarite: ['cz-a-2026-11-22', 5, 'cz-a-2026-11-22'] });
  assert.deepEqual(z.cafele.map(c => c.id), ['u1']);
  assert.deepEqual(z.cafeleSarite, ['cz-a-2026-11-22']);
  // zilele vechi, fără cafea, rămân fără câmpurile noi
  assert.equal('cafele' in Z.curataZiNutritie({ data: '2026-11-22', mese: [] }), false);
});

test('avertizări de cofeină față de limita ta și doza unică EFSA', () => {
  assert.deepEqual(C.avertizariCofeina({ cofeina: 300, cofeinaPlan: 300, dozaMaxima: 127 }), []);
  assert.equal(C.avertizariCofeina({ cofeina: 450, cofeinaPlan: 450, dozaMaxima: 127 })[0].tip, 'peste');
  assert.equal(C.avertizariCofeina({ cofeina: 200, cofeinaPlan: 450, dozaMaxima: 127 })[0].tip, 'atentie');
  assert.match(C.avertizariCofeina({ cofeina: 250, cofeinaPlan: 250, dozaMaxima: 250 })[0].text, /200 mg/);
  assert.equal(C.avertizariCofeina({ cofeina: 250, cofeinaPlan: 250, dozaMaxima: 100 }, 200)[0].tip, 'peste');
});

test('istoricul cafelei zilnice: zilele de la început până azi, limitat', () => {
  const z = zilnica();
  assert.deepEqual(C.zileDeCompletatCafea([z], '2026-11-22'), ['2026-11-20', '2026-11-21', '2026-11-22']);
  assert.deepEqual(C.zileDeCompletatCafea([{ ...z, dela: '2026-11-25' }], '2026-11-22'), []);
  assert.deepEqual(C.zileDeCompletatCafea([{ ...z, activ: false }], '2026-11-22'), []);
  assert.equal(C.zileDeCompletatCafea([{ ...z, dela: '2025-01-01' }], '2026-11-22', 120).length, 120);
});

test('sincronizare: cafelele se combină pe id, cafelele scoase se reunesc (fără conflict)', () => {
  const def = S.DEF_SINCRON.zileNutritie;
  const z = zilnica();
  const baza = { data: '2026-11-22', mese: [] };
  // ambele dispozitive pun aceeași cafea zilnică → identic, fără conflict
  const a = C.aplicaCafeleZilnice(baza, [z]).zi, b = C.aplicaCafeleZilnice(baza, [z]).zi;
  let r = S.combinaInregistrare(def, baza, a, b);
  assert.equal(r.ok, true);
  assert.equal(r.date.cafele.length, 1);
  // pe un telefon adaugi o cafea, pe celălalt scoți cafeaua zilnică
  const cuBaza = a;
  const local = { ...cuBaza, cafele: [...cuBaza.cafele, { id: 'u9', ...C.cafeaDinCompozitie({ tip: 'filtru', cantitate: 200 }, idx), baut: true }] };
  const server = C.scoateCafeaDinZi(cuBaza, 'cz-dimineata-2026-11-22');
  r = S.combinaInregistrare(def, cuBaza, local, server);
  assert.equal(r.ok, true);
  assert.deepEqual(r.date.cafele.map(c => c.id), ['u9']);
  assert.deepEqual(r.date.cafeleSarite, ['cz-dimineata-2026-11-22']);
});

test('generatorul: cafeaua planificată intră în totaluri, mesele completează restul țintei', () => {
  const tinte = { kcal: 2200, proteine: 140, carbohidrati: 250, grasimi: 70 };
  const cafele = [{ id: 'u1', ...C.cafeaDinCompozitie({ tip: 'filtru', cantitate: 400, lapte: 'lapte', lapteMl: 300, zaharG: 30 }, idx), baut: true }];
  let n = 0;
  const rng = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const rez = G.genereazaInteligent({ zi: { data: '2026-11-22', mese: [], cafele }, retete: RETETE_BAZA, idx, tinte, rng, idNou: () => `g${n++}`, acum: 1 });
  const kcalMese = rez.mese.reduce((s, i) => s + i.valoriPortie.kcal * i.portii, 0);
  const abatere = rez.raport.abateri.find(a => a.camp === 'kcal');
  assert.ok(Math.abs(abatere.valoare - (kcalMese + cafele[0].valori.kcal)) < 0.5, 'raportul include cafeaua');
  assert.ok(rez.raport.mesaje.some(m => /cafeaua din zi/.test(m.text)));
});
