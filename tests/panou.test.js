// Teste pentru calculele panoului (analiza.js). Rulează cu: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const a = require('../analiza.js');

let id = 0;
const ses = (data, exercitii) => ({ id: ++id, data, exercitii });
const ex = (nume, ...serii) => ({ nume, serii: serii.map(([kg, repetari]) => ({ kg, repetari })) });

test('cheieSaptamana întoarce lunea, inclusiv peste schimbarea de an și de oră', () => {
  assert.equal(a.cheieSaptamana('2026-11-19'), '2026-11-16'); // joi
  assert.equal(a.cheieSaptamana('2026-11-16'), '2026-11-16'); // luni
  assert.equal(a.cheieSaptamana('2026-11-22'), '2026-11-16'); // duminică
  assert.equal(a.cheieSaptamana('2027-01-01'), '2026-12-28');
  assert.equal(a.cheieSaptamana('2026-03-29'), '2026-03-23'); // ziua schimbării orei
});

test('statisticiSesiune și totaluri numără doar seriile cu repetări', () => {
  const s = ses('2026-11-17', [ex('A', [100, 5], [100, 0], [0, 10])]);
  assert.deepEqual(a.statisticiSesiune(s), { serii: 2, volum: 500 });
  assert.deepEqual(a.totaluri([s, s]), { antrenamente: 2, serii: 4, volum: 1000 });
  assert.deepEqual(a.totaluri([]), { antrenamente: 0, serii: 0, volum: 0 });
});

test('rezumatSaptamani grupează pe săptămâni, cu săptămânile goale incluse', () => {
  const sesiuni = [
    ses('2026-11-02', [ex('A', [50, 10])]),  // acum 2 săptămâni
    ses('2026-11-17', [ex('A', [60, 10])]),
    ses('2026-11-19', [ex('A', [60, 5])]),
    ses('2026-01-01', [ex('A', [60, 5])]),   // în afara ferestrei
  ];
  const r = a.rezumatSaptamani(sesiuni, '2026-11-19', 3);
  assert.deepEqual(r.map(s => s.luni), ['2026-11-02', '2026-11-09', '2026-11-16']);
  assert.deepEqual(r.map(s => s.antrenamente), [1, 0, 2]);
  assert.equal(r[2].volum, 900);
  assert.equal(r[2].serii, 2);
});

test('serieSaptamani: săptămâna curentă goală nu rupe seria', () => {
  const sesiuni = ['2026-10-27', '2026-11-03', '2026-11-12'].map(d => ses(d, [ex('A', [10, 10])]));
  assert.deepEqual(a.serieSaptamani(sesiuni, '2026-11-19'), { saptamani: 3, curentaActiva: false });
  const cuAzi = [...sesiuni, ses('2026-11-19', [ex('A', [10, 10])])];
  assert.deepEqual(a.serieSaptamani(cuAzi, '2026-11-19'), { saptamani: 4, curentaActiva: true });
  // o săptămână lipsă rupe seria
  const rupta = ['2026-10-20', '2026-11-03', '2026-11-12'].map(d => ses(d, [ex('A', [10, 10])]));
  assert.equal(a.serieSaptamani(rupta, '2026-11-19').saptamani, 2);
  // ultima sesiune acum 2 săptămâni: seria e 0
  assert.equal(a.serieSaptamani([ses('2026-11-03', [])], '2026-11-19').saptamani, 0);
  assert.equal(a.serieSaptamani([], '2026-11-19').saptamani, 0);
});

test('zileActiveSaptamana marchează zilele cu antrenament (luni = 0)', () => {
  const z = a.zileActiveSaptamana([ses('2026-11-16', []), ses('2026-11-19', []), ses('2026-11-12', [])], '2026-11-19');
  assert.deepEqual(z, [true, false, false, true, false, false, false]);
});

test('sesiuniRecente include azi și exclude ce e mai vechi de N zile', () => {
  const s = ['2026-11-19', '2026-11-13', '2026-11-12'].map(d => ses(d, []));
  assert.deepEqual(a.sesiuniRecente(s, '2026-11-19', 7).map(x => x.data), ['2026-11-19', '2026-11-13']);
});

test('recorduriNoi reia istoricul și găsește momentele de record', () => {
  const sesiuni = [
    ses('2026-11-01', [ex('Împins', [60, 8]), ex('Tracțiuni', [0, 8])]),  // prima dată: nu e record
    ses('2026-11-05', [ex('Împins', [60, 8], [62.5, 6]), ex('Tracțiuni', [0, 10])]),
    ses('2026-11-08', [ex('Împins', [60, 10])]),                       // 1RM estimat mai mare
    ses('2026-11-12', [ex('Împins', [60, 8])]),                        // nimic nou
  ];
  const ev = a.recorduriNoi(sesiuni);
  assert.deepEqual(ev.map(e => [e.data, e.nume, e.tip]), [
    ['2026-11-05', 'Împins', 'greutate'],
    ['2026-11-05', 'Tracțiuni', 'repetari'],
    ['2026-11-08', 'Împins', 'forta'],
  ]);
  assert.equal(ev[0].kg, 62.5);
});

test('recorduriNoi alege cea mai grea serie când sunt mai multe recorduri de greutate', () => {
  const ev = a.recorduriNoi([
    ses('2026-11-01', [ex('A', [60, 5])]),
    ses('2026-11-02', [ex('A', [62.5, 5], [65, 3])]),
  ]);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].kg, 65);
});

test('urmatorulAntrenament alege rutina făcută cel mai demult; niciodată = prima', () => {
  const rutine = [
    { id: 1, nume: 'Piept', exercitii: ['Împins', 'Fluturări'], creat: 1 },
    { id: 2, nume: 'Spate', exercitii: ['Tracțiuni', 'Ramat'], creat: 2 },
    { id: 3, nume: 'Picioare', exercitii: ['Genuflexiuni', 'Presă', 'Fandări'], creat: 3 },
  ];
  const sesiuni = [
    ses('2026-11-10', [ex('Tracțiuni', [0, 8])]),                      // 1 din 2 = jumătate: contează
    ses('2026-11-12', [ex('Împins', [60, 8]), ex('Fluturări', [10, 12])]),
    ses('2026-11-14', [ex('Genuflexiuni', [80, 5])]),                  // 1 din 3: nu ajunge
  ];
  const u = a.urmatorulAntrenament(rutine, sesiuni, () => null, '2026-11-19');
  assert.equal(u.tip, 'rutina');
  assert.equal(u.rutina.nume, 'Picioare');
  assert.equal(u.ultimaData, null);
  const u2 = a.urmatorulAntrenament(rutine.slice(0, 2), sesiuni, () => null, '2026-11-19');
  assert.equal(u2.rutina.nume, 'Spate');
  assert.equal(u2.zile, 9);
});

test('urmatorulAntrenament fără rutine: grupele lucrate cel mai demult', () => {
  const grupe = { 'Împins': 'Piept', 'Tracțiuni': 'Spate', 'Genuflexiuni': 'Picioare', 'Flexii': 'Biceps' };
  const sesiuni = [
    ses('2026-11-01', [ex('Flexii', [10, 10])]),
    ses('2026-11-10', [ex('Tracțiuni', [0, 8])]),
    ses('2026-11-12', [ex('Împins', [60, 8])]),
    ses('2026-11-18', [ex('Genuflexiuni', [80, 5]), ex('Necunoscut', [5, 5])]),
  ];
  const u = a.urmatorulAntrenament([], sesiuni, n => grupe[n] || null, '2026-11-19');
  assert.equal(u.tip, 'grupe');
  assert.deepEqual(u.grupe.map(g => [g.grupa, g.zile]), [['Biceps', 18], ['Spate', 9], ['Piept', 7]]);
  assert.equal(a.urmatorulAntrenament([], [], () => null, '2026-11-19'), null);
});

test('schimbareGreutate compară prima și ultima cântărire din interval', () => {
  const m = [
    { data: '2026-10-01', valoare: 78 },
    { data: '2026-10-25', valoare: 80 },
    { data: '2026-11-18', valoare: 81.2 },
  ];
  const r = a.schimbareGreutate(m, '2026-11-19', 30);
  assert.equal(r.dela, '2026-10-25');
  assert.ok(Math.abs(r.diferenta - 1.2) < 1e-9);
  assert.equal(a.schimbareGreutate([m[2]], '2026-11-19', 30), null);
});
