// Teste pentru statisticile avansate (etapa 5). Rulează cu: node --test tests/*.test.js
// Valorile așteptate sunt calculate de mână în fiecare test.
const test = require('node:test');
const assert = require('node:assert/strict');
const a = require('../analiza.js');
Object.assign(global, a); // statistici.js folosește funcțiile din analiza.js, ca în pagină
const st = require('../statistici.js');

const ses = (data, exercitii, extra = {}) => ({ versiune: 2, data, exercitii, ...extra });
const ex = (nume, serii, extra = {}) => ({ nume, serii, ...extra });
const grupa = n => ({ 'Împins cu bara pe bancă': 'Piept', 'Flotări': 'Piept', 'Genuflexiuni cu bara': 'Cvadricepși', 'Tracțiuni': 'Spate' }[n] || null);
const aproape = (x, y, eps = 1e-6) => assert.ok(Math.abs(x - y) < eps, `${x} ≠ ${y}`);

test.afterEach(() => a.configureazaCalcul({ greutateCorpLa: null, tipExercitiu: null }));

test('volum: doar serii de lucru; drop și eșec contează o dată, încălzirea nu', () => {
  const s = ses('2026-11-02', [ex('Împins cu bara pe bancă', [
    { kg: 40, repetari: 10, tip: 'incalzire' }, // 0
    { kg: 80, repetari: 8 },                   // 640
    { kg: 80, repetari: 6, tip: 'esec' },      // 480
    { kg: 60, repetari: 8, tip: 'drop' },      // 480
    { kg: 80, repetari: 0 },                   // invalidă: 0
  ])]);
  assert.deepEqual(a.statisticiSesiune(s), { serii: 3, volum: 1600 });
});

test('volum la greutatea corpului: greutatea din Corp la data antrenamentului + lestul', () => {
  const masuratori = [
    { data: '2026-10-01', tip: 'Greutate', valoare: 80 },
    { data: '2026-11-01', tip: 'Greutate', valoare: 82 },
    { data: '2026-10-15', tip: 'Talie', valoare: 90 }, // nu e greutate
  ];
  const g = a.functieGreutateCorp(masuratori);
  assert.equal(g('2026-10-20'), 80);   // ultima cântărire dinainte
  assert.equal(g('2026-11-01'), 82);   // aceeași zi
  assert.equal(g('2026-09-01'), 80);   // înainte de prima: prima de după
  assert.equal(a.functieGreutateCorp([])('2026-11-01'), null);
  a.configureazaCalcul({ greutateCorpLa: g });
  const s = ses('2026-11-05', [
    ex('Tracțiuni', [{ kg: 0, repetari: 10 }, { kg: 10, repetari: 6 }], { tip: 'corp' }), // 82×10 + 92×6 = 1372
    ex('Plank', [{ kg: 0, durataSec: 60 }], { tip: 'timp' }),                            // 0
  ]);
  assert.equal(a.statisticiSesiune(s).volum, 1372);
  // fără cântăriri, corpul contează 0, lestul rămâne
  a.configureazaCalcul({ greutateCorpLa: a.functieGreutateCorp([]) });
  assert.equal(a.statisticiSesiune(s).volum, 60);
});

test('tipul exercițiului în sesiunile vechi vine din bibliotecă; în cele noi lipsa înseamnă greutate', () => {
  a.configureazaCalcul({ greutateCorpLa: () => 70, tipExercitiu: n => (n === 'Flotări' ? 'corp' : 'greutate') });
  const veche = { data: '2026-01-01', exercitii: [ex('Flotări', [{ kg: 0, repetari: 20 }])] };
  const noua = ses('2026-01-02', [ex('Flotări', [{ kg: 0, repetari: 20 }])]);
  assert.equal(a.statisticiSesiune(veche).volum, 1400);
  assert.equal(a.statisticiSesiune(noua).volum, 0);
});

test('același exercițiu de două ori în sesiune se unește (progres, recorduri, distribuție)', () => {
  const s = ses('2026-11-03', [
    ex('Împins cu bara pe bancă', [{ kg: 80, repetari: 5 }]),
    ex('Genuflexiuni cu bara', [{ kg: 100, repetari: 5 }]),
    ex('Împins cu bara pe bancă', [{ kg: 70, repetari: 10 }]),
  ]);
  const p = st.progresieExercitiu([s], 'împins cu bara pe bancă');
  assert.equal(p.length, 1);
  assert.equal(p[0].serii, 2);
  assert.equal(p[0].volum, 400 + 700);
  aproape(p[0].e1rm, 70 * (1 + 10 / 30));
  assert.equal(a.recorduriDin([s]).get('împins cu bara pe bancă').volum, 1100);
  assert.equal(a.recorduriNoi([s, { ...s, data: '2026-11-10' }]).length, 0);
  const d = st.distributieGrupe([s], { start: '2026-11-01', sfarsit: '2026-11-30' }, grupa);
  assert.deepEqual(d.map(r => [r.grupa, r.serii]), [['Piept', 2], ['Cvadricepși', 1]]);
});

test('perioade: intervalul, perioada anterioară și filtrarea', () => {
  const sesiuni = [ses('2026-06-01', []), ses('2026-11-10', [])];
  assert.deepEqual(st.intervalPerioada('4s', '2026-11-19', sesiuni), { start: '2026-10-23', sfarsit: '2026-11-19', zile: 28, tot: false });
  assert.deepEqual(st.intervalPerioada('tot', '2026-11-19', sesiuni), { start: '2026-06-01', sfarsit: '2026-11-19', zile: 172, tot: true });
  assert.deepEqual(st.intervalPerioada('tot', '2026-11-19', []), { start: '2026-11-19', sfarsit: '2026-11-19', zile: 1, tot: true });
  assert.deepEqual(st.intervalAnterior({ start: '2026-10-23', sfarsit: '2026-11-19', zile: 28 }), { start: '2026-09-25', sfarsit: '2026-10-22', zile: 28 });
  assert.equal(st.sesiuniIn(sesiuni, { start: '2026-06-01', sfarsit: '2026-06-01' }).length, 1);
});

test('rezumatul perioadei', () => {
  const sesiuni = [
    ses('2026-10-01', [ex('Împins cu bara pe bancă', [{ kg: 50, repetari: 10 }])], { durataActivaMs: 30 * 60000 }), // în afara perioadei
    ses('2026-11-02', [ex('Împins cu bara pe bancă', [{ kg: 60, repetari: 10 }, { kg: 60, repetari: 10 }])], { durataActivaMs: 45 * 60000 }),
    ses('2026-11-02', [ex('Genuflexiuni cu bara', [{ kg: 100, repetari: 5 }])], { durataActivaMs: 15 * 60000 }),
    ses('2026-11-16', [ex('Genuflexiuni cu bara', [{ kg: 50, repetari: 5, tip: 'incalzire' }, { kg: 110, repetari: 5 }])], { durataActivaMs: 60 * 60000 }),
  ];
  const r = st.rezumatPerioada(sesiuni, { start: '2026-10-23', sfarsit: '2026-11-19', zile: 28 });
  assert.deepEqual(r, { antrenamente: 3, serii: 4, volum: 1200 + 500 + 550, minute: 120, zileActive: 2, peSaptamana: 0.75, volumPeAntrenament: 750 });
  const gol = st.rezumatPerioada([], { start: '2026-10-23', sfarsit: '2026-11-19', zile: 28 });
  assert.equal(gol.volumPeAntrenament, 0);
});

test('evoluție săptămânală și lunară: continuă, cu săptămânile goale incluse', () => {
  const sesiuni = [
    ses('2026-11-03', [ex('Împins cu bara pe bancă', [{ kg: 60, repetari: 10 }])]), // marți, săpt. 2 nov
    ses('2026-11-04', [ex('Împins cu bara pe bancă', [{ kg: 60, repetari: 5 }])]),
    ses('2026-11-19', [ex('Împins cu bara pe bancă', [{ kg: 70, repetari: 5 }])]), // săpt. 16 nov
  ];
  const iv = { start: '2026-10-28', sfarsit: '2026-11-19', zile: 23 };
  const sapt = st.evolutie(sesiuni, iv, 'saptamana');
  assert.deepEqual(sapt.map(g => [g.cheie, g.antrenamente, g.volum]), [
    ['2026-10-26', 0, 0], ['2026-11-02', 2, 900], ['2026-11-09', 0, 0], ['2026-11-16', 1, 350]]);
  assert.equal(sapt[1].eticheta, '2 nov');
  const luni = st.evolutie(sesiuni, iv, 'luna');
  assert.deepEqual(luni.map(g => [g.cheie, g.antrenamente, g.serii]), [['2026-10', 0, 0], ['2026-11', 3, 3]]);
  const peAni = st.evolutie([], { start: '2025-12-10', sfarsit: '2026-02-01', zile: 54 }, 'luna');
  assert.deepEqual(peAni.map(g => g.eticheta), ['dec 25', 'ian 26', 'feb']);
});

test('progresie, metrici disponibile și schimbarea de la prima la ultima sesiune', () => {
  const sesiuni = [
    ses('2026-10-01', [ex('Împins cu bara pe bancă', [{ kg: 80, repetari: 5 }, { kg: 70, repetari: 8 }])]),
    ses('2026-10-08', [ex('Tracțiuni', [{ kg: 0, repetari: 8 }])]),
    ses('2026-10-15', [ex('Împins cu bara pe bancă', [{ kg: 85, repetari: 5, tip: 'incalzire' }, { kg: 82.5, repetari: 5 }])]),
  ];
  const p = st.progresieExercitiu(sesiuni, 'Împins cu bara pe bancă');
  assert.deepEqual(p.map(x => [x.data, x.kgMax, x.kgMaxRepetari, x.volum]), [['2026-10-01', 80, 5, 960], ['2026-10-15', 82.5, 5, 412.5]]);
  assert.deepEqual(st.metriciDisponibile(p), ['e1rm', 'kgMax', 'volum', 'repetariMax']);
  const sch = st.schimbareMetrica(p, 'kgMax');
  assert.deepEqual(sch, { de: 80, la: 82.5, diferenta: 2.5, procent: 3.125, sesiuni: 2 });
  assert.equal(st.schimbareMetrica(p.slice(0, 1), 'kgMax'), null);
  assert.deepEqual(st.metriciDisponibile(st.progresieExercitiu(sesiuni, 'Tracțiuni')), ['repetariMax']);
});

test('cea mai mare greutate pe număr de repetări (cel puțin N repetări, fără încălzire)', () => {
  const sesiuni = [
    ses('2026-10-01', [ex('Genuflexiuni cu bara', [{ kg: 100, repetari: 10 }, { kg: 120, repetari: 3 }])]),
    ses('2026-10-08', [ex('Genuflexiuni cu bara', [{ kg: 140, repetari: 1, tip: 'incalzire' }, { kg: 130, repetari: 1 }])]),
  ];
  const r = st.recorduriPeRepetari(sesiuni, 'genuflexiuni cu bara', [1, 3, 5, 8, 10, 12]);
  assert.deepEqual(r.map(x => [x.repetari, x.kg, x.repetariFacute, x.data]), [
    [1, 130, 1, '2026-10-08'], [3, 120, 3, '2026-10-01'], [5, 100, 10, '2026-10-01'],
    [8, 100, 10, '2026-10-01'], [10, 100, 10, '2026-10-01'], [12, 0, 0, null]]);
});

test('forța pe exercițiile principale și lista recordurilor', () => {
  const sesiuni = [
    ses('2026-09-01', [ex('Împins cu bara pe bancă', [{ kg: 100, repetari: 3 }])]), // record absolut, înainte de perioadă
    ses('2026-11-01', [ex('Împins cu bara pe bancă', [{ kg: 80, repetari: 5 }]), ex('Genuflexiuni cu bara', [{ kg: 100, repetari: 5 }])]),
    ses('2026-11-10', [ex('Împins cu bara pe bancă', [{ kg: 90, repetari: 5 }]), ex('Tracțiuni', [{ kg: 0, repetari: 10 }])]),
  ];
  const iv = { start: '2026-10-23', sfarsit: '2026-11-19', zile: 28 };
  const f = st.fortaPrincipale(sesiuni, iv);
  assert.deepEqual(f.map(x => x.nume), ['Împins cu bara pe bancă', 'Genuflexiuni cu bara']); // tracțiunile fără lest nu intră
  aproape(f[0].de, 80 * (1 + 5 / 30));
  aproape(f[0].la, 90 * (1 + 5 / 30));
  aproape(f[0].procent, 12.5);
  aproape(f[0].recordAbsolut, 110);
  assert.equal(f[0].dataRecord, '2026-09-01');
  assert.equal(f[1].procent, null); // o singură sesiune
  const lista = st.listaRecorduri(a.recorduriDin(sesiuni));
  assert.deepEqual(lista.map(r => [r.nume, r.tip, r.data]), [
    ['Tracțiuni', 'repetari', '2026-11-10'], ['Genuflexiuni cu bara', 'forta', '2026-11-01'], ['Împins cu bara pe bancă', 'forta', '2026-09-01']]);
  assert.equal(st.recorduriInPerioada(sesiuni, iv).length, 0); // 90×5 nu bate 100×3 la greutate și nici la 1RM (105 < 110)
});

test('date lipsă sau greșite nu strică calculele', () => {
  const sesiuni = [
    ses('2026-11-01', [ex('Împins cu bara pe bancă', [{ kg: NaN, repetari: 8 }, { kg: -5, repetari: 5 }, { repetari: 'x' }, {}])]),
    ses('2026-11-02', [null, { nume: 'Fără serii' }, ex('Genuflexiuni cu bara', [{ kg: 100, repetari: 5 }])]),
  ];
  const r = st.rezumatPerioada(sesiuni, { start: '2026-11-01', sfarsit: '2026-11-30', zile: 30 });
  assert.ok(Number.isFinite(r.volum) && Number.isFinite(r.serii));
  assert.equal(r.volum, 500);
  const d = st.distributieGrupe(sesiuni, { start: '2026-11-01', sfarsit: '2026-11-30' }, grupa);
  assert.ok(d.every(x => Number.isFinite(x.procent)));
});
