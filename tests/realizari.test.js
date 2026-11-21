// Teste pentru realizări (etapa 7): nivel, obiectivul săptămânal, insigne. Valorile așteptate sunt calculate de mână.
const test = require('node:test');
const assert = require('node:assert/strict');
Object.assign(global, require('../analiza.js'), require('../corp-calcul.js'));
const r = require('../realizari.js');

const ses = (data, exercitii = [{ nume: 'Împins cu bara pe bancă', serii: [{ kg: 60, repetari: 10 }] }], extra = {}) => ({ versiune: 2, data, exercitii, ...extra });
const insigna = (lista, id) => lista.find(i => i.id === id);
const treapta = (lista, id, prag) => insigna(lista, id).trepte.find(t => t.prag === prag);

test('nivelul vine doar din numărul de antrenamente', () => {
  assert.deepEqual(r.nivelDin(0), { nivel: 1, antrenamente: 0, de: 0, urmator: 1, progres: 0, maxim: false });
  assert.equal(r.nivelDin(1).nivel, 2);
  const n = r.nivelDin(30);            // pragurile 20 → 35: nivelul 5
  assert.equal(n.nivel, 5);
  assert.equal(n.progres, 10 / 15);
  assert.equal(r.nivelDin(1000).maxim, true);
  assert.equal(r.nivelDin(5000).progres, 1);
});

test('obiectivul săptămânal: săptămâna curentă nu rupe seria până nu se termină', () => {
  // azi: joi 19.11.2026 (săptămâna din 16.11). Obiectiv 2.
  const s = [ses('2026-10-26'), ses('2026-10-28'),            // săpt. 26.10: 2 ✓
    ses('2026-11-02'), ses('2026-11-04'), ses('2026-11-06'),   // săpt. 02.11: 3 ✓
    ses('2026-11-09'), ses('2026-11-12'),                       // săpt. 09.11: 2 ✓
    ses('2026-11-17')];                                        // săpt. 16.11: 1 (în curs)
  const o = r.obiectivSaptamanal(s, '2026-11-19', 2);
  assert.deepEqual(o, { facute: 1, tinta: 2, atins: false, serie: 3, serieMaxima: 3 });
  const o2 = r.obiectivSaptamanal([...s, ses('2026-11-19')], '2026-11-19', 2);
  assert.deepEqual(o2, { facute: 2, tinta: 2, atins: true, serie: 4, serieMaxima: 4 });
  // o săptămână ratată în trecut rupe seria; cea mai lungă rămâne
  const o3 = r.obiectivSaptamanal(s.filter(x => x.data !== '2026-11-12'), '2026-11-19', 2);
  assert.deepEqual([o3.serie, o3.serieMaxima], [0, 2]);
  assert.deepEqual(r.obiectivSaptamanal([], '2026-11-19', 3), { facute: 0, tinta: 3, atins: false, serie: 0, serieMaxima: 0 });
});

test('insigne de consecvență: data deblocării e data antrenamentului care a atins pragul', () => {
  const s = Array.from({ length: 12 }, (_, i) => ses(dataDinZi(ziDinData('2026-09-07') + i * 7)));  // 12 săptămâni la rând, câte una
  const ins = r.calculeazaInsigne({ sesiuni: s, tinta: 1 });
  assert.equal(treapta(ins, 'antrenamente', 1).data, '2026-09-07');
  assert.equal(treapta(ins, 'antrenamente', 10).data, '2026-11-09');
  assert.equal(treapta(ins, 'antrenamente', 25).data, null);
  assert.equal(treapta(ins, 'saptamani', 12).data, '2026-11-23');
  assert.equal(treapta(ins, 'obiectiv', 8).data, '2026-10-26');
  const a = insigna(ins, 'antrenamente');
  assert.equal(a.valoare, 12); assert.equal(a.deblocate, 2); assert.equal(a.urmatoarea.prag, 25); assert.equal(a.progres, 12 / 25);
});

test('volum, ore, recorduri și exerciții diferite', () => {
  const s = [
    ses('2026-11-01', [{ nume: 'Genuflexiuni cu bara', serii: [{ kg: 100, repetari: 5, tip: 'incalzire' }, ...Array(20).fill({ kg: 100, repetari: 5 })] }], { durataActivaMs: 6 * 3600000 }),   // 10 t, 6 h
    ses('2026-11-02', [{ nume: 'Genuflexiuni cu bara', serii: [{ kg: 105, repetari: 5 }] }], { durataActivaMs: 4 * 3600000 }),        // record (greutate)
  ];
  const ins = r.calculeazaInsigne({ sesiuni: s });
  assert.equal(treapta(ins, 'volum', 10).data, '2026-11-01');        // 20×500 = 10 000 kg (încălzirea nu)
  assert.equal(treapta(ins, 'ore', 10).data, '2026-11-02');          // 6 + 4
  assert.equal(treapta(ins, 'recorduri', 1).data, '2026-11-02');
  assert.equal(insigna(ins, 'exercitii').valoare, 1);
});

test('corp complet: toate cele 6 zone într-o săptămână', () => {
  const grupaDe = n => ({ A: 'Piept', B: 'Spate', C: 'Umeri', D: 'Triceps', E: 'Gambe', F: 'Abdomen' }[n]);
  const ex = n => ({ nume: n, serii: [{ kg: 10, repetari: 10 }] });
  const s = [ses('2026-11-16', [ex('A'), ex('B'), ex('C')]), ses('2026-11-18', [ex('D'), ex('E')]), ses('2026-11-20', [ex('F')]),
    ses('2026-11-23', [ex('A'), ex('B'), ex('C'), ex('D'), ex('E')])];   // săptămâna următoare: fără abdomen
  const ins = r.calculeazaInsigne({ sesiuni: s, grupaDe });
  assert.equal(treapta(ins, 'complet', 1).data, '2026-11-20');
  assert.equal(insigna(ins, 'complet').valoare, 1);
});

test('forța față de greutatea corpului; fără cântăriri insigna cere greutatea', () => {
  const s = [ses('2026-11-01', [{ nume: 'Împins cu bara pe bancă', serii: [{ kg: 75, repetari: 6 }] }]),        // 1RM 90
    ses('2026-11-10', [{ nume: 'Împins cu bara pe bancă', serii: [{ kg: 90, repetari: 3 }] }])];                   // 1RM 99
  const fara = r.calculeazaInsigne({ sesiuni: s });
  assert.equal(insigna(fara, 'impins').indisponibil, 'Notează-ți greutatea în Corp.');
  const g = functieGreutateCorp([{ data: '2026-10-01', tip: 'Greutate', valoare: 90 }]);
  const cu = r.calculeazaInsigne({ sesiuni: s, greutateCorpLa: g });
  assert.equal(treapta(cu, 'impins', 1).data, '2026-11-01');          // 90 / 90 = 1.0×
  assert.equal(treapta(cu, 'impins', 1.25).data, null);              // 99 / 90 = 1.1×
  assert.equal(insigna(cu, 'impins').valoareText, '1.1×');
  const tr = r.calculeazaInsigne({ sesiuni: [ses('2026-11-01', [{ nume: 'Tracțiuni', tip: 'corp', serii: [{ kg: 0, repetari: 11 }, { kg: 0, repetari: 12, tip: 'incalzire' }] }])] });
  assert.equal(insigna(tr, 'tractiuni').valoare, 11);
  assert.equal(treapta(tr, 'tractiuni', 10).data, '2026-11-01');
});

test('insignele de corp: cântăriri, măsurări complete, poze, greutatea țintă', () => {
  const m = [];
  for (let i = 0; i < 10; i++) m.push({ data: dataDinZi(ziDinData('2026-10-01') + i), tip: 'Greutate', valoare: 85 - i * 0.5 });
  for (const t of ['Talie', 'Piept', 'Braț', 'Coapsă', 'Gât']) m.push({ data: '2026-10-05', tip: t, valoare: 50 });
  for (const t of ['Talie', 'Piept', 'Braț', 'Coapsă']) m.push({ data: '2026-10-20', tip: t, valoare: 50 });   // doar 4
  const ins = r.calculeazaInsigne({ sesiuni: [], masuratori: m, poze: [{ data: '2026-10-01' }, { data: '2026-10-01' }, { data: '2026-10-15' }],
    obiectiv: { tinta: 82, start: 85, dela: '2026-10-01' } });
  assert.equal(treapta(ins, 'cantariri', 10).data, '2026-10-10');
  assert.equal(insigna(ins, 'masurari').valoare, 1);
  assert.equal(insigna(ins, 'poze').valoare, 2);
  // media pe 7 zile: 09.10 → (84 … 81)/7 = 82.5; 10.10 → (83.5 … 80.5)/7 = 82.0 ≤ 82 → atinsă pe 10.10
  assert.equal(treapta(ins, 'tinta', 1).data, '2026-10-10');
  assert.equal(insigna(r.calculeazaInsigne({ sesiuni: [] }), 'tinta').indisponibil, 'Setează o greutate țintă în Corp.');
});

test('editarea sau ștergerea unui antrenament schimbă realizările; ce e nou după salvare', () => {
  const s = Array.from({ length: 9 }, (_, i) => ses(dataDinZi(ziDinData('2026-11-01') + i)));
  const inainte = r.calculeazaInsigne({ sesiuni: s });
  const dupa = r.calculeazaInsigne({ sesiuni: [...s, ses('2026-11-10')] });
  assert.deepEqual(r.deblocateNoi(inainte, dupa).map(x => [x.id, x.eticheta]), [['antrenamente', '10']]);
  assert.equal(treapta(r.calculeazaInsigne({ sesiuni: s.slice(1) }), 'antrenamente', 10).data, null);   // după ștergere
  assert.equal(r.deblocateRecent(dupa)[0].id, 'antrenamente');
  assert.equal(r.urmatoareaInsigna(dupa).id !== undefined, true);
});

test('treptele: bronz, argint, aur, platină', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(i => r.metal(i, 7)), ['bronz', 'bronz', 'argint', 'argint', 'aur', 'aur', 'platina']);
  assert.deepEqual([0, 1, 2].map(i => r.metal(i, 3)), ['bronz', 'argint', 'aur']);
  assert.equal(r.metal(0, 1), 'aur');
});
