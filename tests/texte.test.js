// Acordul numerelor în română: „1 serie”, „5 serii”, „20 de serii”.
const test = require('node:test');
const assert = require('node:assert/strict');
const { plural, numarDe } = require('../ui.js');

test('plural: „de” de la 20 în sus (cu excepția terminațiilor 01–19)', () => {
  assert.equal(plural(1, 'serie', 'serii'), '1 serie');
  assert.equal(plural(0, 'serie', 'serii'), '0 serii');
  assert.equal(plural(5, 'serie', 'serii'), '5 serii');
  assert.equal(plural(19, 'serie', 'serii'), '19 serii');
  assert.equal(plural(20, 'serie', 'serii'), '20 de serii');
  assert.equal(plural(101, 'serie', 'serii'), '101 serii');
  assert.equal(plural(120, 'serie', 'serii'), '120 de serii');
});

test('numarDe: numărul singur, cu „de” când e nevoie', () => {
  assert.equal(numarDe(3), '3');
  assert.equal(numarDe(19), '19');
  assert.equal(numarDe(20), '20 de');
  assert.equal(numarDe(100), '100 de');
  assert.equal(numarDe(112), '112');
  assert.equal(numarDe(0), '0');
});

test('textul de renunțare: singular „Seria bifată … se va pierde”, plural cu „de”', () => {
  const fs = require('node:fs');
  const s = fs.readFileSync(require('node:path').join(__dirname, '..', 'sesiune.js'), 'utf8');
  assert.ok(s.includes("serii === 1 ? 'Seria bifată de azi se va pierde.'"), 'la o singură serie: „Seria bifată de azi se va pierde.”');
  assert.ok(!s.includes('Cele 1 '), 'niciun „Cele 1 …”');
});
