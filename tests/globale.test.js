// Fișierele din index.html sunt scripturi clasice care împart același spațiu global:
// un nume declarat de două ori (const/let/function) oprește încărcarea unui fișier întreg.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Scripturile din index.html (nucleul) plus cele încărcate la cerere (incarcare.js → SCRIPTURI_NUTRITIE).
const { SCRIPTURI_NUTRITIE } = require('../incarcare.js');
const scripturiNucleu = R => fs.readFileSync(path.join(R, 'index.html'), 'utf8').match(/src="([a-z-]+\.js)/g).map(x => x.slice(5));

test('niciun nume global declarat în două fișiere', () => {
  const R = path.join(__dirname, '..');
  const fisiere = [...scripturiNucleu(R), ...SCRIPTURI_NUTRITIE];
  const vazute = new Map();
  const dubluri = [];
  for (const f of fisiere) {
    const s = fs.readFileSync(path.join(R, f), 'utf8');
    for (const m of s.matchAll(/^(?:const|let|var|function|async function|class)\s+([A-Za-z_$][\w$]*)/gm)) {
      if (vazute.has(m[1])) dubluri.push(`${m[1]}: ${vazute.get(m[1])} și ${f}`);
      else vazute.set(m[1], f);
    }
  }
  assert.deepEqual(dubluri, []);
});

test('fiecare script din index.html e în lista de fișiere a service workerului (funcționare offline)', () => {
  const R = path.join(__dirname, '..');
  const scripturi = [...scripturiNucleu(R), ...SCRIPTURI_NUTRITIE];
  const sw = fs.readFileSync(path.join(R, 'sw.js'), 'utf8');
  assert.deepEqual(scripturi.filter(f => !sw.includes(`'${f}'`)), []);
});

test('modulele încărcate la cerere nu sunt și în index.html, iar fișierele există', () => {
  const R = path.join(__dirname, '..');
  const nucleu = scripturiNucleu(R);
  assert.deepEqual(SCRIPTURI_NUTRITIE.filter(f => nucleu.includes(f)), []);
  assert.deepEqual([...nucleu, ...SCRIPTURI_NUTRITIE].filter(f => !fs.existsSync(path.join(R, f))), []);
});
