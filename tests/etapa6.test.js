// Etapa 6: regula de securitate a paginii (CSP), descrierea, workflow-urile.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const citeste = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

function csp() {
  const m = citeste('index.html').match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/);
  assert.ok(m, 'index.html are CSP');
  return Object.fromEntries(m[1].split(';').map(s => s.trim().split(/\s+/)).map(([k, ...v]) => [k, v]));
}

test('CSP: doar fișierele aplicației; datele doar la proiectul Supabase din cloud-config.js', () => {
  const c = csp();
  assert.deepEqual(c['script-src'], ["'self'"]);
  assert.deepEqual(c['style-src'], ["'self'"]);
  assert.deepEqual(c['object-src'], ["'none'"]);
  const url = citeste('cloud-config.js').match(/url: '([^']+)'/)[1];
  assert.ok(c['connect-src'].includes(new URL(url).origin), 'connect-src conține adresa proiectului');
  assert.ok(!Object.values(c).flat().some(v => /unsafe/.test(v)), 'fără unsafe-inline / unsafe-eval');
});

test('pagina nu are scripturi, stiluri sau handlere scrise direct în HTML (ar fi blocate de CSP)', () => {
  const h = citeste('index.html');
  assert.doesNotMatch(h, /<script(?![^>]*\bsrc=)[^>]*>/, 'fără <script> fără src');
  assert.doesNotMatch(h, /<style[\s>]/);
  assert.doesNotMatch(h, /\sstyle="/);
  assert.doesNotMatch(h, /\son[a-z]+="/);
});

test('fișierele JS nu pun atribute style și nu folosesc eval / innerHTML', () => {
  for (const f of fs.readdirSync(path.join(__dirname, '..')).filter(f => f.endsWith('.js'))) {
    const s = citeste(f);
    assert.doesNotMatch(s, /setAttribute\(\s*['"]style['"]/, f);
    assert.doesNotMatch(s, /\beval\(|new Function\(/, f);
    assert.doesNotMatch(s, /\.innerHTML\s*=/, f);
  }
});

test('pagina are descriere (meta description) în română', () => {
  assert.match(citeste('index.html'), /<meta name="description" content="Jurnal de antrenament și nutriție[^"]+">/);
});

test('workflow-uri: testele rulează la fiecare urcare; CLI-ul Supabase e fixat; se publică și „sterge-cont”', () => {
  const t = citeste('.github/workflows/teste.yml');
  assert.match(t, /node --test tests\/\*\.test\.js/);
  assert.match(t, /node-version: '22'/);
  const f = citeste('.github/workflows/supabase-functii.yml');
  assert.match(f, /version: 2\.122\.0/);
  assert.doesNotMatch(f, /version: latest/);
  assert.match(f, /functions deploy sterge-cont/);
});
