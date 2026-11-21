// Teste pentru siguranța datelor (etapa 8): exportul CSV și mementoul pentru backup. Rulează cu: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const a = require('../analiza.js');
Object.assign(global, a, require('../corp-calcul.js'));
const sg = require('../siguranta.js');

test('celulele CSV: virgulă zecimală, ghilimele când e nevoie, gol pentru lipsă', () => {
  assert.equal(sg.celulaCsv(82.5), '82,5');
  assert.equal(sg.celulaCsv(1 / 3), '0,33');
  assert.equal(sg.celulaCsv('Împins; bara'), '"Împins; bara"');
  assert.equal(sg.celulaCsv('a "b"'), '"a ""b"""');
  assert.equal(sg.celulaCsv('rând\nnou'), '"rând\nnou"');
  assert.equal(sg.celulaCsv(null), '');
  assert.equal(sg.celulaCsv(NaN), '');
});

test('CSV antrenamente: un rând pe serie validă, cu tipul seriei și volumul aplicației', () => {
  a.configureazaCalcul({ greutateCorpLa: () => 80 });
  const sesiuni = [
    { versiune: 2, data: '2026-11-02', nota: 'bună; ziua', exercitii: [
      { nume: 'Tracțiuni', tip: 'corp', serii: [{ kg: 0, repetari: 10 }] }] },
    { versiune: 2, data: '2026-11-01', exercitii: [
      { nume: 'Împins cu bara pe bancă', supraset: 'A', serii: [{ kg: 40, repetari: 10, tip: 'incalzire' }, { kg: 82.5, repetari: 5 }, { kg: 82.5, repetari: 0 }] },
      { nume: 'Plank', tip: 'timp', serii: [{ kg: 0, durataSec: 60 }] }] },
  ];
  const csv = sg.csvAntrenamente(sesiuni, n => (n === 'Tracțiuni' ? 'Spate' : n === 'Plank' ? 'Abdomen' : 'Piept'));
  assert.ok(csv.startsWith('﻿Data;Antrenament;Exercițiu;Grupă;Serie;'));
  const r = csv.slice(1).trim().split('\r\n');
  assert.equal(r.length, 5); // antet + 4 serii valide (seria cu 0 repetări lipsește)
  assert.equal(r[1], '2026-11-01;1;Împins cu bara pe bancă;Piept;1;încălzire;40;10;;;0;A;');
  assert.equal(r[2], '2026-11-01;1;Împins cu bara pe bancă;Piept;2;normală;82,5;5;;;412,5;A;');
  assert.equal(r[3], '2026-11-01;1;Plank;Abdomen;1;normală;0;;60;;0;;');
  assert.equal(r[4], '2026-11-02;2;Tracțiuni;Spate;1;normală;0;10;;;800;;"bună; ziua"');
  a.configureazaCalcul({ greutateCorpLa: null });
});

test('CSV măsurători: cu unitatea tipului', () => {
  const csv = sg.csvMasuratori([{ data: '2026-11-02', tip: 'Talie', valoare: 88.5 }, { data: '2026-11-01', tip: 'Greutate', valoare: 82 }, { data: '2026-11-01', tip: 'biceps încordat', valoare: 40 }]);
  assert.deepEqual(csv.slice(1).trim().split('\r\n'), ['Data;Tip;Valoare;Unitate', '2026-11-01;biceps încordat;40;', '2026-11-01;Greutate;82;kg', '2026-11-02;Talie;88,5;cm']);
});

test('mementoul pentru backup: de la 3 antrenamente, dacă n-ai exportat niciodată sau de 14+ zile', () => {
  const acum = Date.parse('2026-11-21T12:00:00Z');
  assert.equal(sg.trebuieMementoBackup(null, 2, acum), null);
  assert.deepEqual(sg.trebuieMementoBackup(null, 3, acum), { niciodata: true, zile: null });
  assert.deepEqual(sg.trebuieMementoBackup('stricat', 3, acum), { niciodata: true, zile: null });
  assert.equal(sg.trebuieMementoBackup('2026-11-10T12:00:00Z', 30, acum), null);          // 11 zile
  assert.deepEqual(sg.trebuieMementoBackup('2026-11-07T12:00:00Z', 30, acum), { niciodata: false, zile: 14 });
});
