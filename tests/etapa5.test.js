// Etapa 5: textele despre date (după cont), tema ca setare, numele modurilor.
const test = require('node:test');
const assert = require('node:assert/strict');
const { textConfidentialitate } = require('../ui.js');
const { MODURI, TEME, temaEfectiva } = require('../tema.js');

test('textele despre date spun adevărul: fără cont doar pe telefon, cu cont și în cont (cu e-mailul)', () => {
  global.sinc = { utilizator: null };
  assert.equal(textConfidentialitate(), 'Datele stau doar pe acest telefon.');
  assert.match(textConfidentialitate('stergere'), /nu sunt trimise nicăieri/);
  assert.match(textConfidentialitate('poze'), /doar pe acest telefon/);
  global.sinc = { utilizator: { email: 'ana@exemplu.ro' } };
  assert.equal(textConfidentialitate(), 'Datele se salvează pe telefon și în contul tău (ana@exemplu.ro).');
  assert.doesNotMatch(textConfidentialitate('stergere'), /nicăieri/);
  assert.match(textConfidentialitate('stergere'), /datele din cont rămân/);
  assert.match(textConfidentialitate('poze'), /în contul tău \(ana@exemplu\.ro\)/);
  // scanarea: poza merge la analiză și nu e păstrată pe server (verificat în funcția scanare)
  assert.match(textConfidentialitate('scanare'), /nu e păstrată pe server/);
  delete global.sinc;
  assert.equal(textConfidentialitate(), 'Datele stau doar pe acest telefon.', 'fără modulul de cont: ca fără cont');
});

test('tema: întunecată implicit; „Ca sistemul” urmează telefonul', () => {
  assert.deepEqual(TEME, ['intunecata', 'deschisa', 'sistem']);
  assert.equal(temaEfectiva('intunecata'), 'intunecata');
  assert.equal(temaEfectiva('deschisa'), 'deschisa');
  assert.equal(temaEfectiva('altceva'), 'intunecata');
  global.matchMedia = q => ({ matches: q.includes('light') });
  assert.equal(temaEfectiva('sistem'), 'deschisa');
  global.matchMedia = () => ({ matches: false });
  assert.equal(temaEfectiva('sistem'), 'intunecata');
  delete global.matchMedia;
});

test('modurile se numesc „Sală” și „Nutriție” (id-urile interne rămân pentru compatibilitate)', () => {
  assert.equal(MODURI.gym.nume, 'Sală');
  assert.equal(MODURI.mealprep.nume, 'Nutriție');
});

test('tema nu se sincronizează între telefoane (ca modul)', () => {
  const { SETARI_LOCALE } = require('../sincron.js');
  assert.ok(SETARI_LOCALE.includes('tema') && SETARI_LOCALE.includes('mod'));
});
