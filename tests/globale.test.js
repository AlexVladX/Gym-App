// Fișierele din index.html sunt scripturi clasice care împart același spațiu global:
// un nume declarat de două ori (const/let/function) oprește încărcarea unui fișier întreg.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('niciun nume global declarat în două fișiere', () => {
  const R = path.join(__dirname, '..');
  const fisiere = fs.readFileSync(path.join(R, 'index.html'), 'utf8').match(/src="([a-z-]+\.js)/g).map(x => x.slice(5));
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
  const scripturi = fs.readFileSync(path.join(R, 'index.html'), 'utf8').match(/src="([a-z-]+\.js)/g).map(x => x.slice(5));
  const sw = fs.readFileSync(path.join(R, 'sw.js'), 'utf8');
  assert.deepEqual(scripturi.filter(f => !sw.includes(`'${f}'`)), []);
});
